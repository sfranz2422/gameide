"""
GameIDE's Python runtime: GameObject, the engine API students call, and the
one function JavaScript calls every frame.

How the bridge works (read this before changing anything here)
----------------------------------------------------------------

Every instance's built-in properties (x, y, hspeed, sprite, alarm[3], ...)
live in ONE flat array of doubles, `_st`, STRIDE numbers per instance. This
module allocates it; JavaScript gets a view onto the very same bytes in the
WebAssembly heap (bridge.ts, `getBuffer`). So `self.x += 4` here and the
engine's motion code over there are touching the same number, and nothing
is copied across the bridge per frame.

The layout (which index is x, which is hspeed) is not written down in this
file. It is handed in from layout.ts by `_setup`, so the two sides cannot
disagree. If they ever did, `self.x` would read `self.y` and nothing would
fail loudly — keep it that way.

JavaScript calls `_frame()` once per step. Inside it, Python runs Begin
Step, Alarm, Keyboard, Mouse and Step events, then calls back into the
engine (`_js.motion()`) to apply speeds, gravity and friction and to find
collisions, then runs Collision, End Step and Draw events, and returns a
compact JSON string of what JavaScript must do (draw this text, change to
that room) — or None, the common case, when there is nothing.

Collision queries (place_meeting and friends) call into the engine's spatial
hash. They are the only other crossings, and they pass only numbers: the
type name is turned into an index here, so no string crosses per call.

What is never done here: rendering, collision detection, moving things.
Python is the scripting layer only; anything per-pixel or per-pair belongs
in the engine.
"""

import builtins
import difflib
import json
import linecache
import re
import math
import traceback
from array import array
from types import SimpleNamespace

import _engine as _js  # the Engine's query functions, registered by bridge.ts

# Every name a student's code can use without importing anything. The test
# suite checks this list against the API catalog (src/catalog/api.ts) both
# ways, so a function cannot be added here without docs, or listed in the
# docs without existing.
__all__ = [
    "GameObject",
    # instances
    "instance_create", "instance_exists", "instance_number", "instance_nearest", "instances",
    # collision
    "place_meeting", "place_free", "instance_place", "collision_point", "tile_at", "tile_set",
    # input
    "keyboard_check", "keyboard_check_pressed", "keyboard_check_released",
    "mouse_check", "mouse_check_pressed", "mouse_check_released", "mouse_x", "mouse_y",
    # movement
    "move_towards", "point_direction", "point_distance", "move_and_collide",
    # drawing
    "draw_self", "draw_sprite", "draw_text", "draw_rect", "draw_set_color",
    # rooms and the game
    "room_goto", "room_restart", "game_restart", "global_vars", "room_width", "room_height",
    # the camera
    "camera_follow", "camera_set", "camera_shake", "view_x", "view_y", "view_width", "view_height",
    # debugging
    "show_debug",
]

# Names in __all__ that are values, not functions. Their values change every
# frame, so they are re-written into the students' namespace each frame
# (`_publish_globals`) — `from x import *` would copy them once and leave
# them stale.
_LIVE_GLOBALS = ("mouse_x", "mouse_y", "room_width", "room_height", "view_x", "view_y", "view_width", "view_height")

mouse_x = 0.0
mouse_y = 0.0
room_width = 0
room_height = 0
view_x = 0.0
view_y = 0.0
view_width = 0
view_height = 0
global_vars = SimpleNamespace()

# ---------------------------------------------------------------- shared state
# All filled in by _setup(). Module globals rather than attributes of some
# object, because property getters run thousands of times a frame and a
# global lookup is the cheapest thing Python has.

_L = None            # the layout, as a namespace (L.F.X, L.STRIDE, ...)
STRIDE = 0
_st = array("d")     # instance state, STRIDE doubles per slot
_dirty = array("i")  # [count, slot, ...]   slots the spatial hash must re-file
_ev = array("i")     # [count, overflowed, kind, a, b, ...]   from the engine
_res = array("i")    # [count, slot, ...]   multi-instance query results
_keys = array("B")   # [held * K, pressed * K, released * K]
_g = array("d")      # mouse, room size, slots in use
_capacity = 0

_objs = []           # slot -> GameObject (or None)
_free = []           # slots free for reuse
_next = 0            # high-water mark of slots handed out
_all = []            # live instances, in creation order (GameMaker's order)
_by_type = []        # type index -> [instances of exactly that type]
_dead = []           # destroyed this frame; their slots are freed at frame end

_types = []          # type index -> SimpleNamespace(name, cls, parent, ...)
_type_index = {}     # object name -> type index
_lower_index = {}    # lower-case object name -> type index (collision events)
_descendants = []    # type index -> [it and every type inheriting from it]
_templates = []      # type index -> array of STRIDE doubles: a new instance
_sprite_index = {}   # sprite name -> index
_sprite_names = []   # index -> sprite name
_rooms = []          # room definitions from the game

# Event lists: the instances that have a given per-frame event. Built as
# instances are created, so a frame never asks every instance "do you have
# on_step?" — with 300 instances and a handful of objects that has them,
# that matters.
_lists = {}

_cur = None          # the instance whose event is running (for place_meeting(...))
_in_draw = False
_draw_depth = 0.0
_draw = []           # draw commands this frame, in the room
_gui = []            # …and on the screen, from Draw GUI events (not moved by the camera)
_draw_list = _draw   # where draw_* functions are writing now
_creation_fns = {}   # (room index, instance index) -> that instance's creation code
_color = 0xFFFFFF
_debug = None
_debug_changed = False
_pending_room = None
_room_now = -1
_room_changed = False
_warned = set()
_warnings = []
_ns = {}             # the namespace student code runs in

# ---------------------------------------------------------------- events

# Events with a fixed name. Anything else starting with on_ must match one
# of the patterns in _classify, or the student gets a warning — a misspelt
# event (on_stepp) would otherwise be a method nobody ever calls, with no
# sign anything is wrong.
_SIMPLE_EVENTS = {
    "on_create", "on_destroy", "on_cleanup",
    "on_begin_step", "on_step", "on_end_step", "on_draw", "on_draw_gui",
    "on_room_start", "on_room_end", "on_game_start",
    "on_animation_end", "on_outside_room", "on_intersect_boundary",
}
_PER_FRAME = ("on_begin_step", "on_step", "on_end_step", "on_draw", "on_draw_gui")
_KEY_KINDS = ("down", "pressed", "released")
_BUTTONS = ("left", "right", "middle")
_EDGES = ("pressed", "released")


def _warn(message):
    """A problem worth telling the student about once, not sixty times a second."""
    if message not in _warned:
        _warned.add(message)
        _warnings.append(message)


def _suggest(word, choices):
    close = difflib.get_close_matches(word, list(choices), n=1)
    return f' Did you mean "{close[0]}"?' if close else ""


def _classify(cls, name, t):
    """
    Files one on_ method of an object's class. Returns False when the name
    is not an event, so the caller can warn.
    """
    h = _types[t].handlers
    if name in _SIMPLE_EVENTS:
        return True
    if name.startswith("on_collision_"):
        target = name[len("on_collision_"):]
        if target not in _lower_index:
            _warn(f'{cls.__name__} has {name}, but there is no object called "{target}".'
                  + _suggest(target, _lower_index))
            return True  # it is an event, just aimed at nothing
        h.collisions[_lower_index[target]] = name
        return True
    if name.startswith("on_key_"):
        rest = name[len("on_key_"):]
        kind, _, key = rest.partition("_")
        if kind in _KEY_KINDS and key in _KEY:
            h.keys.append((_KEY_KINDS.index(kind) * _KEY_COUNT + _KEY[key], name))
            return True
        return False
    if name.startswith("on_global_mouse_"):
        button, _, edge = name[len("on_global_mouse_"):].partition("_")
        if button in _BUTTONS and edge in _EDGES:
            base = _L.G.MOUSE_PRESSED if edge == "pressed" else _L.G.MOUSE_RELEASED
            h.global_mouse.append((base + _BUTTONS.index(button), name))
            return True
        return False
    if name.startswith("on_mouse_"):
        button, _, edge = name[len("on_mouse_"):].partition("_")
        if button in _BUTTONS and edge in _EDGES:
            h.mouse = True
            return True
        return False
    if name.startswith("on_alarm_"):
        n = name[len("on_alarm_"):]
        return n.isdigit() and 0 <= int(n) < _L.ALARM_COUNT
    return False


def _scan_handlers(t):
    cls = _types[t].cls
    h = SimpleNamespace(collisions={}, keys=[], global_mouse=[], mouse=False)
    _types[t].handlers = h
    known = _SIMPLE_EVENTS | {"on_key_down_left", "on_key_pressed_space", "on_alarm_0",
                              "on_mouse_left_pressed", "on_global_mouse_left_pressed"}
    for name in dir(cls):
        if not name.startswith("on_") or not callable(getattr(cls, name, None)):
            continue
        if not _classify(cls, name, t):
            _warn(f"{cls.__name__} has a method called {name}, which is not an event, so it never runs."
                  + _suggest(name, known))


# ---------------------------------------------------------------- GameObject

class GameObject:
    """
    The base of every object's class. Built-in properties (x, y, speed, ...)
    are attached by _setup as properties over the shared state array; a
    student's own attributes (self.lives = 3) are ordinary Python attributes.

    Instances are made with instance_create(), never by calling the class:
    an instance needs a slot in the shared array before it can have an x.
    """

    def __init__(self, *args, **kwargs):
        raise TypeError(
            f'Make a {type(self).__name__} with instance_create(x, y, "{type(self).__name__}"), '
            "not by calling the class.")

    def __repr__(self):
        if not self._alive:
            return f"<{type(self).__name__} (destroyed)>"
        return f"<{type(self).__name__} at ({self.x:g}, {self.y:g})>"

    @property
    def object_name(self):
        return _types[self._t].name

    @property
    def alarm(self):
        return _Alarms(self)

    def destroy(self):
        """Removes this instance, after running its Destroy and Clean Up events."""
        if not self._alive:
            return
        self._alive = False
        b = self._b
        _st[b + _F_ALIVE] = 0.0
        _mark_dirty(self._slot, b)
        _dead.append(self)
        _call(self, "on_destroy")
        _call(self, "on_cleanup")

    def once(self, key, condition):
        """
        True the first step `condition` is true, then not again until it has
        been false — GDevelop's "Trigger once", which event sheets write as
        `if self.once("a1b2c3", keyboard_check("space")):`. The key keeps one
        row's memory apart from another's; each instance has its own.
        """
        memory = self.__dict__.setdefault("_once", {})
        now = bool(condition)
        before = memory.get(key, False)
        memory[key] = now
        return now and not before

    # The collision helpers as methods, for students who prefer
    # self.place_meeting(...) — the global forms use the running instance.
    def place_meeting(self, x, y, obj):
        return _js_place_meeting(self._slot, x, y, _target_of(obj))

    def place_free(self, x, y):
        return _js_place_free(self._slot, x, y)

    def instance_place(self, x, y, obj):
        return _inst(_js_instance_place(self._slot, x, y, _target_of(obj)))

    def move_and_collide(self, dx, dy, obj=None):
        n = _js_move_and_collide(self._slot, dx, dy, -1 if obj is None else _target_of(obj))
        # Instances it bumped into, and the name of any tile layer — so
        # `if move_and_collide(0, self.vy):` is true when the floor stops it.
        return [_objs[c] if c >= 0 else _tile_layer_names()[-2 - c] for c in (_res[i] for i in range(1, n + 1))]

    def move_towards(self, x, y, speed):
        self.direction = point_direction(self.x, self.y, x, y)
        self.speed = speed

    def draw_self(self):
        if _check_draw("draw_self"):
            _st[self._b + _F_DRAWN] = 1.0


class _Alarms:
    """self.alarm — indexable, backed by the shared array."""

    __slots__ = ("_b",)

    def __init__(self, inst):
        self._b = inst._b + _L.F.ALARM0

    def _check(self, i):
        if not isinstance(i, int) or not 0 <= i < _L.ALARM_COUNT:
            raise IndexError(f"alarm numbers go from 0 to {_L.ALARM_COUNT - 1}, not {i!r}")

    def __getitem__(self, i):
        self._check(i)
        return _st[self._b + i]

    def __setitem__(self, i, steps):
        self._check(i)
        _st[self._b + i] = steps

    def __len__(self):
        return _L.ALARM_COUNT


def _mark_dirty(slot, b):
    """Queue a slot for the spatial hash. See `dirty` in layout.ts."""
    if not _st[b + _F_DIRTY]:
        _st[b + _F_DIRTY] = 1.0
        n = _dirty[0] + 1
        _dirty[0] = n
        _dirty[n] = slot


def _install_properties():
    """Attaches the built-in properties to GameObject, using the layout from JS."""
    F = _L.F

    def plain(i):
        def get(self):
            return _st[self._b + i]

        def set_(self, v):
            _st[self._b + i] = v
        return property(get, set_)

    def boxy(i):
        # Moving, rescaling or changing sprite changes the collision box,
        # so the spatial hash must hear about it before the next query.
        def get(self):
            return _st[self._b + i]

        def set_(self, v):
            b = self._b
            _st[b + i] = v
            if not _st[b + _F_DIRTY]:
                _mark_dirty(self._slot, b)
        return property(get, set_)

    def flag(i):
        def get(self):
            return _st[self._b + i] != 0

        def set_(self, v):
            _st[self._b + i] = 1.0 if v else 0.0
        return property(get, set_)

    # hspeed/vspeed and speed/direction describe the same motion two ways;
    # setting either pair recalculates the other, as in GameMaker.
    def set_polar(b):
        h = _st[b + F.HSPEED]
        v = _st[b + F.VSPEED]
        _st[b + F.SPEED] = math.hypot(h, v)
        if h or v:
            _st[b + F.DIRECTION] = math.degrees(math.atan2(-v, h)) % 360

    def set_cartesian(b):
        s = _st[b + F.SPEED]
        d = math.radians(_st[b + F.DIRECTION])
        h = math.cos(d) * s
        v = -math.sin(d) * s
        # cos(90°) is 6e-17, not 0. A student who sets direction = 90 and
        # prints hspeed should see 0.
        _st[b + F.HSPEED] = 0.0 if abs(h) < 1e-9 else h
        _st[b + F.VSPEED] = 0.0 if abs(v) < 1e-9 else v

    def cartesian(i):
        def get(self):
            return _st[self._b + i]

        def set_(self, v):
            b = self._b
            _st[b + i] = v
            set_polar(b)
        return property(get, set_)

    def polar(i):
        def get(self):
            return _st[self._b + i]

        def set_(self, v):
            b = self._b
            _st[b + i] = v
            set_cartesian(b)
        return property(get, set_)

    def sprite_get(self):
        i = int(_st[self._b + F.SPRITE])
        return _sprite_names[i] if i >= 0 else None

    def sprite_set(self, name):
        _st[self._b + F.SPRITE] = _sprite_of(name)
        _mark_dirty(self._slot, self._b)

    props = {
        "x": boxy(F.X), "y": boxy(F.Y),
        "xprevious": plain(F.XPREV), "yprevious": plain(F.YPREV),
        "hspeed": cartesian(F.HSPEED), "vspeed": cartesian(F.VSPEED),
        "speed": polar(F.SPEED), "direction": polar(F.DIRECTION),
        "gravity": plain(F.GRAVITY), "gravity_direction": plain(F.GRAVITY_DIR),
        "friction": plain(F.FRICTION),
        "sprite": property(sprite_get, sprite_set),
        "image_index": plain(F.IMAGE_INDEX), "image_speed": plain(F.IMAGE_SPEED),
        "image_xscale": boxy(F.XSCALE), "image_yscale": boxy(F.YSCALE),
        "image_angle": plain(F.ANGLE), "image_alpha": plain(F.ALPHA),
        "visible": flag(F.VISIBLE), "solid": flag(F.SOLID),
        "depth": plain(F.DEPTH),
    }
    for name, prop in props.items():
        setattr(GameObject, name, prop)
    global _BUILTIN_PROPS
    _BUILTIN_PROPS = tuple(props) + ("object_name", "alarm")


_BUILTIN_PROPS = ()
_ghosts = {}


def _ghost(cls):
    """
    The class a destroyed instance becomes once its slot is handed to someone
    else. Its built-in properties become plain attributes holding their last
    values, so code that kept a reference — `instance_create(e.x, e.y,
    "Explosion")` a frame after `e.destroy()` — reads where it really was,
    instead of the position of whatever new instance now owns the slot.
    """
    g = _ghosts.get(cls)
    if g is None:
        body = {name: None for name in _BUILTIN_PROPS}
        body["destroy"] = lambda self: None
        body["__repr__"] = lambda self: f"<{cls.__name__} (destroyed)>"
        g = type(cls.__name__, (cls,), body)
        _ghosts[cls] = g
    return g


# Field indices the hottest paths use, copied out of _L for speed.
_F_ALIVE = _F_DIRTY = _F_DRAWN = 0

# ---------------------------------------------------------------- names -> indices

_KEY = {}
_KEY_COUNT = 0
_COLORS = {
    "aqua": 0x00FFFF, "black": 0x000000, "blue": 0x0000FF, "dkgray": 0x404040,
    "fuchsia": 0xFF00FF, "gray": 0x808080, "green": 0x008000, "lime": 0x00FF00,
    "ltgray": 0xC0C0C0, "maroon": 0x800000, "navy": 0x000080, "olive": 0x808000,
    "orange": 0xFFA040, "purple": 0x800080, "red": 0xFF0000, "silver": 0xC0C0C0,
    "teal": 0x008080, "white": 0xFFFFFF, "yellow": 0xFFFF00,
}


def _tile_layer_names():
    """This room's tile layers, by name, in the order the engine numbers them."""
    if _room_now < 0:
        return []
    return [l["name"] for l in _rooms[_room_now].get("tileLayers", [])]


def _target_of(obj):
    """
    What a collision check is aimed at: an object (its type index), or a
    tile layer of this room by name (as -2 - its number, the engine's code
    for "that layer's solid tiles"). Objects win if a name is both.
    """
    if isinstance(obj, str) and obj not in _type_index:
        layers = _tile_layer_names()
        if obj in layers:
            return -2 - layers.index(obj)
        raise NameError(f'There is no object or tile layer called "{obj}".'
                        + _suggest(obj, list(_type_index) + layers))
    return _type_of(obj)


def _type_of(obj):
    """An object name (or class) as its type index, with a helpful error."""
    if isinstance(obj, str):
        t = _type_index.get(obj)
        if t is None:
            raise NameError(f'There is no object called "{obj}".' + _suggest(obj, _type_index))
        return t
    if isinstance(obj, type) and issubclass(obj, GameObject):
        return _type_of(obj.__name__)
    raise TypeError(f'Name an object with a string, like "Wall" — not {obj!r}.')


def _sprite_of(name):
    if name is None:
        return -1
    i = _sprite_index.get(name)
    if i is None:
        raise NameError(f'There is no sprite called "{name}".' + _suggest(str(name), _sprite_index))
    return i


def _key_code(key):
    c = _KEY.get(key)
    if c is None:
        c = _KEY.get(str(key).lower())
        if c is None:
            raise ValueError(f'"{key}" is not a key GameIDE knows.' + _suggest(str(key).lower(), _KEY)
                             + ' Keys are named like "left", "space", "a", "1".')
    return c


def _button(button):
    try:
        return _BUTTONS.index(button)
    except ValueError:
        raise ValueError(f'Mouse buttons are "left", "right" or "middle", not {button!r}.') from None


def _inst(slot):
    return _objs[slot] if slot >= 0 else None


def _me(fn):
    """The instance whose event is running, for the global collision functions."""
    if _cur is None:
        raise RuntimeError(f"{fn}() needs an instance — call it from inside an event like on_step.")
    return _cur


# ---------------------------------------------------------------- the public API

def instance_create(x, y, obj):
    """Makes a new instance at (x, y) and runs its Create event straight away."""
    return _create(_type_of(obj), x, y)


def instance_exists(obj):
    if isinstance(obj, GameObject):
        return obj._alive
    return instance_number(obj) > 0


def instance_number(obj):
    n = 0
    for t in _descendants[_type_of(obj)]:
        for o in _by_type[t]:
            if o._alive:
                n += 1
    return n


def instance_nearest(x, y, obj):
    me = _cur._slot if _cur is not None else -1
    return _inst(_js_instance_nearest(x, y, _type_of(obj), me))


def instances(obj):
    out = []
    for t in _descendants[_type_of(obj)]:
        out.extend(o for o in _by_type[t] if o._alive)
    return out


def place_meeting(x, y, obj):
    return _me("place_meeting").place_meeting(x, y, obj)


def place_free(x, y):
    return _me("place_free").place_free(x, y)


def instance_place(x, y, obj):
    return _me("instance_place").instance_place(x, y, obj)


def collision_point(x, y, obj):
    return _inst(_js_collision_point(x, y, _type_of(obj)))


def move_and_collide(dx, dy, obj=None):
    return _me("move_and_collide").move_and_collide(dx, dy, obj)


def move_towards(x, y, speed):
    _me("move_towards").move_towards(x, y, speed)


def point_direction(x1, y1, x2, y2):
    """Degrees from (x1, y1) to (x2, y2): 0 is right, 90 is up."""
    return math.degrees(math.atan2(y1 - y2, x2 - x1)) % 360


def point_distance(x1, y1, x2, y2):
    return math.hypot(x2 - x1, y2 - y1)


def keyboard_check(key):
    return _keys[_key_code(key)] == 1


def keyboard_check_pressed(key):
    return _keys[_KEY_COUNT + _key_code(key)] == 1


def keyboard_check_released(key):
    return _keys[2 * _KEY_COUNT + _key_code(key)] == 1


def mouse_check(button="left"):
    return _g[_L.G.MOUSE_DOWN + _button(button)] == 1


def mouse_check_pressed(button="left"):
    return _g[_L.G.MOUSE_PRESSED + _button(button)] == 1


def mouse_check_released(button="left"):
    return _g[_L.G.MOUSE_RELEASED + _button(button)] == 1


def _check_draw(fn):
    # Drawing outside a Draw event does nothing in GameMaker either, but
    # there it is silent, and "my text doesn't show" is an afternoon lost.
    if not _in_draw:
        _warn(f"{fn}() only draws inside an on_draw or on_draw_gui event.")
        return False
    return True


def draw_self():
    if _check_draw("draw_self"):
        _me("draw_self").draw_self()


def draw_sprite(sprite, frame, x, y):
    if _check_draw("draw_sprite"):
        _draw_list.append(["sprite", _draw_depth, _sprite_of(sprite), frame, x, y])


def draw_text(x, y, text):
    if _check_draw("draw_text"):
        _draw_list.append(["text", _draw_depth, x, y, str(text), _color])


def draw_rect(x1, y1, x2, y2, outline=False):
    if _check_draw("draw_rect"):
        _draw_list.append(["rect", _draw_depth, x1, y1, x2, y2, _color, 1 if outline else 0])


def draw_set_color(color):
    """A colour name ("red"), "#rrggbb", an (r, g, b) tuple, or 0xRRGGBB."""
    global _color
    if isinstance(color, str):
        c = color.strip().lower()
        if c.startswith("#") and len(c) == 7:
            try:
                _color = int(c[1:], 16)
                return
            except ValueError:
                pass
        if c in _COLORS:
            _color = _COLORS[c]
            return
        raise ValueError(f'"{color}" is not a colour GameIDE knows.' + _suggest(c, _COLORS)
                         + ' Use a name like "red", or "#ff8800".')
    if isinstance(color, tuple) and len(color) == 3:
        r, g, b = (max(0, min(255, int(v))) for v in color)
        _color = (r << 16) | (g << 8) | b
        return
    if isinstance(color, int):
        _color = color & 0xFFFFFF
        return
    raise TypeError(f"draw_set_color wants a name, \"#rrggbb\" or (r, g, b), not {color!r}")


def room_goto(room):
    """Changes room at the end of this step, as GameMaker does."""
    global _pending_room
    for i, r in enumerate(_rooms):
        if r["name"] == room:
            _pending_room = i
            return
    raise NameError(f'There is no room called "{room}".' + _suggest(str(room), [r["name"] for r in _rooms]))


def room_restart():
    global _pending_room
    _pending_room = _room_now


def game_restart():
    global _pending_room
    _pending_room = "restart"


def camera_follow(instance, smoothing=None):
    """Keeps the view centred on an instance (None stops). smoothing: 1 sticks, 0.1 glides."""
    if instance is None:
        _js.camera_follow(-1, -1.0)
        return
    if not isinstance(instance, GameObject):
        raise TypeError(f"camera_follow wants an instance, like camera_follow(self), not {instance!r}.")
    _js.camera_follow(instance._slot, -1.0 if smoothing is None else max(0.0, min(1.0, float(smoothing))))


def camera_set(x, y):
    """Puts the view's top-left corner at (x, y), and stops following."""
    _js.camera_set(x, y)


def camera_shake(strength=4, steps=15):
    """Shakes the view by up to `strength` pixels, fading out over `steps` steps."""
    _js.camera_shake(strength, steps)


def _layer_number(layer):
    layers = _tile_layer_names()
    if layer is None:
        return -1
    if layer not in layers:
        raise NameError(f'This room has no tile layer called "{layer}".' + _suggest(str(layer), layers)
                        + ("" if layers else " It has no tile layers at all."))
    return layers.index(layer)


def tile_at(x, y, layer=None):
    """The tile number at (x, y) on a tile layer (or the topmost one), or None if empty."""
    t = _js.tile_at(x, y, _layer_number(layer))
    return None if t < 0 else t


def tile_set(x, y, tile, layer=None):
    """Puts tile number `tile` at (x, y) (None clears it), on a tile layer or the room's first."""
    n = _layer_number(layer)
    if n < 0:
        if not _tile_layer_names():
            raise NameError("This room has no tile layers to change.")
        n = 0
    _js.tile_set(x, y, -1 if tile is None else int(tile), n)


def show_debug(text):
    """Shows text in the corner of the game, over everything, until changed."""
    global _debug, _debug_changed
    _debug = None if text is None else str(text)
    _debug_changed = True


# ---------------------------------------------------------------- lifecycle

def _call(o, name):
    """Runs one event on one instance, if it has it, as the running instance."""
    global _cur
    m = getattr(o, name, None)
    if m is None:
        return
    prev = _cur
    _cur = o
    try:
        m()
    finally:
        _cur = prev


def _call_all(lst, name):
    """
    Runs an event on every instance in a list. Only the instances there when
    it started: ones created during the loop wait for the next step, and
    destroyed ones are skipped (they leave the list at frame end).
    """
    global _cur
    for i in range(len(lst)):
        o = lst[i]
        if o._alive:
            _cur = o
            getattr(o, name)()
    _cur = None


def _create(t, x, y, placed=None):
    """A new instance. `placed` is a room instance's overrides (scale,
    angle), applied before its Create event as GameMaker does."""
    global _next
    if _free:
        slot = _free.pop()
    else:
        slot = _next
        if slot >= _capacity:
            _grow()
        _next += 1
        _g[_L.G.SLOTS] = _next
    b = slot * STRIDE
    F = _L.F
    gen = _st[b + F.GEN] + 1
    was_dirty = _st[b + _F_DIRTY]
    _st[b:b + STRIDE] = _templates[t]
    _st[b + F.GEN] = gen
    # A reused slot may still be queued from its last owner's destroy; keep
    # the flag so it is not queued twice (the queue is sized to one per slot).
    _st[b + _F_DIRTY] = was_dirty
    _st[b + F.X] = _st[b + F.XPREV] = x
    _st[b + F.Y] = _st[b + F.YPREV] = y
    if placed:
        _st[b + F.XSCALE] = placed.get("scaleX", 1)
        _st[b + F.YSCALE] = placed.get("scaleY", 1)
        _st[b + F.ANGLE] = placed.get("angle", 0)
    _mark_dirty(slot, b)

    ty = _types[t]
    o = ty.cls.__new__(ty.cls)
    o._slot = slot
    o._b = b
    o._t = t
    o._alive = True
    _objs[slot] = o
    _all.append(o)
    _by_type[t].append(o)
    for name in ty.per_frame:
        _lists[name].append(o)
    _call(o, "on_create")
    return o


def _grow():
    """Doubles every per-slot array. JavaScript is told to take new views."""
    global _st, _dirty, _res, _ev, _capacity
    cap = max(64, _capacity * 2)
    st = array("d", bytes(8 * cap * STRIDE))
    st[0:len(_st)] = _st
    dirty = array("i", bytes(4 * (cap + 1)))
    dirty[0:len(_dirty)] = _dirty
    _st, _dirty = st, dirty
    _res = array("i", bytes(4 * (cap + 1)))
    _ev = array("i", bytes(4 * (_L.EVENTS_HEADER + 3 * max(4096, cap * 8))))
    _objs.extend([None] * (cap - _capacity))
    _capacity = cap
    _js.rebind()


def _reap():
    """
    End of frame: the slots of instances destroyed this frame are freed, and
    the instances themselves become ghosts (see _ghost).
    """
    global _all
    if not _dead:
        return
    for o in _dead:
        b = o._b
        values = {name: getattr(o, name) for name in _BUILTIN_PROPS if name not in ("alarm",)}
        o.__class__ = _ghost(type(o))
        o.__dict__.update(values)
        _objs[o._slot] = None
        _free.append(o._slot)
        # A ghost must never reach the engine with its old slot, which now
        # belongs to someone else: -1 matches no instance on the JS side.
        o._slot = -1
    _dead.clear()
    _all = [o for o in _all if o._alive]
    for t in range(len(_by_type)):
        if any(not o._alive for o in _by_type[t]):
            _by_type[t] = [o for o in _by_type[t] if o._alive]
    for name in _lists:
        lst = _lists[name]
        if any(not o._alive for o in lst):
            lst[:] = [o for o in lst if o._alive]


def _kill_quietly(o):
    """Removes an instance at a room change: Clean Up runs, Destroy does not."""
    if not o._alive:
        return
    _call(o, "on_cleanup")
    o._alive = False
    _st[o._b + _F_ALIVE] = 0.0
    _mark_dirty(o._slot, o._b)
    _dead.append(o)


def _goto(index, first=False):
    """Leaves the current room (if any) and builds room `index`."""
    global _room_now, _room_changed, room_width, room_height, _cur
    if _room_now >= 0:
        for o in list(_all):
            if o._alive:
                _call(o, "on_room_end")
        for o in list(_all):
            if o._alive and not _types[o._t].persistent:
                _kill_quietly(o)
        _reap()
    room = _rooms[index]
    _room_now = index
    _room_changed = True
    room_width = room["width"]
    room_height = room["height"]
    _g[_L.G.ROOM_WIDTH] = room_width
    _g[_L.G.ROOM_HEIGHT] = room_height
    _publish_globals()
    # GameMaker's order: each instance's Create then its creation code, then
    # Game Start (first room only), then Room Start.
    for i, inst in enumerate(room["instances"]):
        o = _create(_type_of(inst["object"]), inst["x"], inst["y"], inst)
        code = _creation_fns.get((index, i))
        if code is not None and o._alive:
            prev, _cur = _cur, o
            try:
                code(o)
            finally:
                _cur = prev
    if first:
        for o in list(_all):
            if o._alive:
                _call(o, "on_game_start")
    for o in list(_all):
        if o._alive:
            _call(o, "on_room_start")


def _restart_game():
    global _room_now
    for o in list(_all):
        _kill_quietly(o)
    _reap()
    global_vars.__dict__.clear()
    _room_now = -1
    _goto(0, first=True)


def _publish_globals():
    global mouse_x, mouse_y, view_x, view_y, view_width, view_height
    G = _L.G
    mouse_x = _g[G.MOUSE_X]
    mouse_y = _g[G.MOUSE_Y]
    view_x, view_y = _g[G.VIEW_X], _g[G.VIEW_Y]
    view_width, view_height = int(_g[G.VIEW_W]), int(_g[G.VIEW_H])
    ns = _ns
    ns["mouse_x"] = mouse_x
    ns["mouse_y"] = mouse_y
    ns["room_width"] = room_width
    ns["room_height"] = room_height
    ns["view_x"] = view_x
    ns["view_y"] = view_y
    ns["view_width"] = view_width
    ns["view_height"] = view_height


# ---------------------------------------------------------------- the frame

def _dispatch_engine_events():
    """Turns what the engine wrote into `_ev` into event calls."""
    global _cur
    EV = _L.EV
    ev = _ev
    n = ev[0]
    if ev[1]:
        _warn("More collisions happened in one step than GameIDE can report; some were skipped.")
    i = _L.EVENTS_HEADER
    for _ in range(n):
        kind, a, b = ev[i], ev[i + 1], ev[i + 2]
        i += 3
        o = _objs[a]
        if o is None or not o._alive:
            continue
        if kind == EV.COLLISION:
            other = _objs[b]
            if other is None or not other._alive:
                continue
            name = _types[o._t].coll_for[other._t]
            if name is None:
                continue
            # GameMaker: touching a solid instance puts you back where you
            # were before the step's movement, then the event runs.
            if other.solid:
                o.x = o.xprevious
                o.y = o.yprevious
            _cur = o
            getattr(o, name)(other)
        elif kind == EV.ALARM:
            _call(o, f"on_alarm_{b}")
        elif kind == EV.MOUSE:
            _call(o, f"on_mouse_{_BUTTONS[b >> 1]}_{_EDGES[b & 1]}")
        elif kind == EV.ANIMATION_END:
            _call(o, "on_animation_end")
        elif kind == EV.OUTSIDE_ROOM:
            _call(o, "on_outside_room")
        elif kind == EV.INTERSECT_BOUNDARY:
            _call(o, "on_intersect_boundary")
    _cur = None


def _input_events():
    """Keyboard and global mouse events, for the instances that have any."""
    global _cur
    keys = _keys
    lst = _lists["keyboard"]
    for i in range(len(lst)):
        o = lst[i]
        if not o._alive:
            continue
        for index, name in _types[o._t].handlers.keys:
            if keys[index]:
                _cur = o
                getattr(o, name)()
                if not o._alive:
                    break
    g = _g
    lst = _lists["global_mouse"]
    for i in range(len(lst)):
        o = lst[i]
        if not o._alive:
            continue
        for index, name in _types[o._t].handlers.global_mouse:
            if g[index]:
                _cur = o
                getattr(o, name)()
                if not o._alive:
                    break
    _cur = None


def _draw_events():
    """Draw, into the room, then Draw GUI, onto the screen over everything."""
    global _in_draw, _draw_depth, _cur, _color, _draw_list
    for name, target in (("on_draw", _draw), ("on_draw_gui", _gui)):
        lst = _lists[name]
        if not lst:
            continue
        _in_draw = True
        _draw_list = target
        _color = 0xFFFFFF
        try:
            for i in range(len(lst)):
                o = lst[i]
                if o._alive:
                    _cur = o
                    _draw_depth = o.depth
                    getattr(o, name)()
        finally:
            _in_draw = False
            _cur = None


def _end_of_frame():
    global _pending_room
    _reap()
    if _pending_room is not None:
        target, _pending_room = _pending_room, None
        if target == "restart":
            _restart_game()
        else:
            _goto(target)


def _commands():
    """What JavaScript must do after this frame, as JSON — or None for nothing."""
    global _draw, _gui, _debug_changed, _room_changed
    out = {}
    if _draw:
        out["draw"] = _draw
        _draw = []
    if _gui:
        out["gui"] = _gui
        _gui = []
    if _debug_changed:
        out["debug"] = _debug
        _debug_changed = False
    if _room_changed:
        out["room"] = _room_now
        _room_changed = False
    if _warnings:
        out["warnings"] = list(_warnings)
        _warnings.clear()
    return json.dumps(out) if out else None


def _frame():
    """
    One step of the game. Called by JavaScript, once per frame, after the
    engine's beginStep(). Never raises: a student's error comes back as
    {"error": ...} so the engine can stop and show it.
    """
    global _cur, _in_draw
    try:
        _publish_globals()
        _call_all(_lists["on_begin_step"], "on_begin_step")
        _dispatch_engine_events()        # alarms and mouse-on-instance
        _input_events()
        _call_all(_lists["on_step"], "on_step")
        _js_motion()                     # engine: move, animate, collide
        _dispatch_engine_events()        # collisions, animation end, outside room
        _call_all(_lists["on_end_step"], "on_end_step")
        _draw_events()
        _end_of_frame()
        return _commands()
    except (Exception, KeyboardInterrupt) as e:  # noqa: BLE001 — every student error must reach the IDE
        _cur = None
        _in_draw = False
        return _error_json(e)


def _start():
    """Builds the first room. Called once, after _setup."""
    try:
        _goto(0, first=True)
        _reap()
        return _commands()
    except (Exception, KeyboardInterrupt) as e:  # noqa: BLE001
        return _error_json(e)


# ---------------------------------------------------------------- errors

def _student_frame(filename):
    return filename.startswith(("<object ", "<script ", "<instance "))


def _error_report(e):
    """
    A Python exception as Object → Event → line, using only the student's
    own frames. The runtime's frames (this file) are dropped: "line 612 in
    _call_all" says nothing to a student.
    """
    frames = [f for f in traceback.extract_tb(e.__traceback__) if _student_frame(f.filename)]
    kind = obj = event = line = None
    where = None
    if isinstance(e, SyntaxError) and e.filename and _student_frame(e.filename):
        where = e.filename
        line = e.lineno
    elif frames:
        last = frames[-1]
        where = last.filename
        event = last.name if last.name != "<module>" else None
        line = last.lineno
    if where:
        # "<object Player>" -> ("object", "Player")
        kind, _, obj = where[1:-1].partition(" ")
    hang = isinstance(e, KeyboardInterrupt)
    if hang:
        # Raised by the editor through Pyodide's interrupt buffer when the
        # game stops answering. "KeyboardInterrupt" means nothing to a
        # student; where it was when it was stopped means a great deal.
        message = ("This game stopped responding, so GameIDE stopped it. The line shown was "
                   "still running — is there a loop that never ends?")
    else:
        message = "".join(traceback.format_exception_only(type(e), e)).strip()
    tb = "".join(traceback.format_list(frames)) if frames else ""
    return {"kind": kind, "object": obj, "event": event, "line": line, "message": message,
            "traceback": tb, "hang": hang}


def _error_json(e):
    out = {"error": _error_report(e)}
    if _warnings:
        out["warnings"] = list(_warnings)
        _warnings.clear()
    return json.dumps(out)


# ---------------------------------------------------------------- setup

def _arrays():
    """The shared arrays, for bridge.ts to take views of. Order matters there."""
    return (_st, _dirty, _ev, _res, _keys, _g)


def _setup(layout_json, game_json):
    """
    Loads a game: the layout from layout.ts, then the game's objects, rooms
    and code. Returns None, or an error as JSON (a syntax error in an
    object's code, a class that is not a GameObject).
    """
    global _L, STRIDE, _keys, _g, _KEY, _KEY_COUNT, _rooms, _ns
    global _F_ALIVE, _F_DIRTY, _F_DRAWN

    def ns(d):
        return SimpleNamespace(**{k: ns(v) if isinstance(v, dict) else v for k, v in d.items()})

    _L = ns(json.loads(layout_json))
    STRIDE = _L.STRIDE
    F = _L.F
    _F_ALIVE, _F_DIRTY, _F_DRAWN = F.ALIVE, F.DIRTY, F.DRAWN
    _KEY = {k: i for i, k in enumerate(_L.KEY_NAMES)}
    _KEY_COUNT = len(_L.KEY_NAMES)
    _keys = array("B", bytes(3 * _KEY_COUNT))
    _g = array("d", bytes(8 * _L.G_SIZE))
    _install_properties()
    _grow()  # the first allocation; also tells JS to take its views

    game = json.loads(game_json)
    for i, s in enumerate(game["sprites"]):
        _sprite_index[s["name"]] = i
        _sprite_names.append(s["name"])
    _rooms = game["rooms"]
    for name in ("on_begin_step", "on_step", "on_end_step", "on_draw", "on_draw_gui", "keyboard", "global_mouse"):
        _lists[name] = []

    _ns = {"__name__": "game", "__builtins__": builtins}
    for name in __all__:
        _ns[name] = globals()[name]

    try:
        return _load_game(game)
    except (Exception, KeyboardInterrupt) as e:  # noqa: BLE001
        return _error_json(e)


def _compile_into_ns(kind, name, source):
    """
    Runs one object's (or script's) code in the shared namespace, under a
    filename that says whose code it is. The source is put in linecache so
    tracebacks can quote the student's line.
    """
    filename = f"<{kind} {name}>"
    linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)
    exec(compile(source, filename, "exec"), _ns)


def _load_game(game):
    objects = game["objects"]
    for i, o in enumerate(objects):
        _type_index[o["name"]] = i
        _lower_index[o["name"].lower()] = i

    for name, source in (game.get("scripts") or {}).items():
        _compile_into_ns("script", name, source)
    for name, source in game["code"].items():
        if name not in _type_index:
            _warn(f'There is code for "{name}", but no object called that.')
        _compile_into_ns("object", name, source)

    # Each room instance's creation code, as a function of `self`, under a
    # filename naming the room and instance so errors can point at it.
    for ri, room in enumerate(game["rooms"]):
        for ii, inst in enumerate(room["instances"]):
            code = inst.get("code") or ""
            if not code.strip():
                continue
            # Leading tabs become 4 spaces, as in object code (codegen.ts).
            body = [("    " + re.sub(r"^\t+", lambda m: "    " * len(m.group()), line)) if line.strip() else ""
                    for line in code.replace("\r\n", "\n").split("\n")]
            if not any(l.strip() and not l.strip().startswith("#") for l in body):
                body.append("    pass")
            source = "def _creation(self):\n" + "\n".join(body) + "\n"
            filename = f"<instance {ri}:{ii}>"
            linecache.cache[filename] = (len(source), None, source.splitlines(True), filename)
            scope = {}
            exec(compile(source, filename, "exec"), _ns, scope)
            _creation_fns[(ri, ii)] = scope["_creation"]

    # One class per object. Objects with no code still get one, inheriting
    # from their parent's, so a child with no events behaves like its parent.
    making = set()

    def class_for(i):
        o = objects[i]
        if i < len(_types) and _types[i] is not None:
            return _types[i].cls
        if i in making:
            raise TypeError(f'{o["name"]} is its own ancestor — check the parent settings.')
        making.add(i)
        parent = o.get("parent")
        base = class_for(_type_of(parent)) if parent else GameObject
        cls = _ns.get(o["name"]) if o["name"] in game["code"] else None
        if cls is None:
            cls = type(o["name"], (base,), {})
        elif not (isinstance(cls, type) and issubclass(cls, GameObject)):
            raise TypeError(f'The code for {o["name"]} must define "class {o["name"]}(GameObject):".')
        while len(_types) <= i:
            _types.append(None)
        _types[i] = SimpleNamespace(name=o["name"], cls=cls, parent=parent,
                                    persistent=bool(o.get("persistent", False)))
        return cls

    for i in range(len(objects)):
        class_for(i)

    n = len(objects)
    for t in range(n):
        _by_type.append([])
        _descendants.append([u for u in range(n) if _inherits(u, t, objects)])
    for t in range(n):
        _scan_handlers(t)

    # Which collision method fires for each pair of types. A handler for a
    # parent fires for its children, unless the child has its own: walk the
    # other type up its ancestry and take the first handler found.
    H = _L.HANDLES
    collides = [0] * (n * n)
    flags = [0] * n
    for t in range(n):
        ty = _types[t]
        h = ty.handlers
        ty.coll_for = [None] * n
        for u in range(n):
            cur = u
            seen = set()
            while cur is not None and cur not in seen:
                seen.add(cur)
                if cur in h.collisions:
                    ty.coll_for[u] = h.collisions[cur]
                    collides[t * n + u] = 1
                    break
                p = objects[cur].get("parent")
                cur = _type_index.get(p) if p else None
        cls = ty.cls
        f = 0
        if h.collisions:
            f |= H.COLLISION
        if hasattr(cls, "on_outside_room"):
            f |= H.OUTSIDE_ROOM
        if hasattr(cls, "on_intersect_boundary"):
            f |= H.INTERSECT_BOUNDARY
        if hasattr(cls, "on_animation_end"):
            f |= H.ANIMATION_END
        if hasattr(cls, "on_draw"):
            f |= H.DRAW
        if h.mouse:
            f |= H.MOUSE
        flags[t] = f
        ty.per_frame = [name for name in _PER_FRAME if hasattr(cls, name)]
        if h.keys:
            ty.per_frame.append("keyboard")
        if h.global_mouse:
            ty.per_frame.append("global_mouse")

        # The block a new instance of this type starts from.
        F = _L.F
        tpl = array("d", bytes(8 * STRIDE))
        o = objects[t]
        tpl[F.ALIVE] = 1.0
        tpl[F.TYPE] = t
        tpl[F.SPRITE] = _sprite_of(o.get("sprite"))
        tpl[F.IMAGE_SPEED] = 1.0
        tpl[F.XSCALE] = tpl[F.YSCALE] = tpl[F.ALPHA] = 1.0
        tpl[F.VISIBLE] = 1.0 if o.get("visible", True) else 0.0
        tpl[F.SOLID] = 1.0 if o.get("solid", False) else 0.0
        tpl[F.DEPTH] = o.get("depth", 0)
        for a in range(_L.ALARM_COUNT):
            tpl[F.ALARM0 + a] = -1.0
        _templates.append(tpl)

    _js.configure(json.dumps({"collides": collides, "flags": flags}))
    if _warnings:
        out = {"warnings": list(_warnings)}
        _warnings.clear()
        return json.dumps(out)
    return None


def _inherits(u, t, objects):
    """Is type u type t, or a descendant of it?"""
    seen = set()
    while u is not None and u not in seen:
        if u == t:
            return True
        seen.add(u)
        p = objects[u].get("parent")
        u = _type_index.get(p) if p else None
    return False


# The engine's functions, looked up once. Attribute access on a JsProxy is
# not free, and these run inside students' loops.
_js_place_meeting = _js.place_meeting
_js_place_free = _js.place_free
_js_instance_place = _js.instance_place
_js_collision_point = _js.collision_point
_js_instance_nearest = _js.instance_nearest
_js_move_and_collide = _js.move_and_collide
_js_motion = _js.motion
