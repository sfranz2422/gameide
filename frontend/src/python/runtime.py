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
    "collision_line", "path_find",
    # input
    "keyboard_check", "keyboard_check_pressed", "keyboard_check_released", "touch_controls",
    "mouse_check", "mouse_check_pressed", "mouse_check_released", "mouse_x", "mouse_y",
    "gamepad_check", "gamepad_check_pressed", "gamepad_check_released", "gamepad_axis", "gamepad_connected",
    # movement
    "move_towards", "point_direction", "point_distance", "move_and_collide",
    # drawing
    "draw_self", "draw_sprite", "draw_text", "draw_rect", "draw_set_color", "draw_set_font",
    "draw_sprite_ext", "draw_line", "draw_circle", "draw_ellipse", "draw_triangle", "draw_rect_gradient",
    "draw_set_halign", "draw_set_valign", "string_width", "string_height",
    # small maths
    "clamp", "lerp", "approach", "sign", "choose",
    # rooms and the game
    "room_goto", "room_restart", "game_restart", "global_vars", "room_width", "room_height",
    "game_pause", "game_paused",
    # the camera
    "camera_follow", "camera_set", "camera_shake", "camera_zoom", "view_x", "view_y", "view_width", "view_height",
    # sound
    "sound_play", "sound_stop", "sound_playing", "music_play", "music_stop",
    # saving
    "save_set", "save_get", "save_delete", "save_clear",
    # game feel
    "particles", "effect", "weather", "particles_clear", "hit_pause", "lighting", "light", "screen_effect",
    "screen_flash", "screen_fade", "tween", "tween_stop", "ease", "say", "dialogue_open", "dialogue_clear",
    "draw_set_alpha",
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
_alpha = 1.0         # draw_set_alpha: how solid draw_* calls draw, 0 to 1
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

    def flash(self, color="white", steps=6):
        """Draws this instance as one solid colour for a few steps: the classic "I was hit"."""
        b = self._b
        _st[b + _L.F.FLASH_COLOR] = _parse_color(color, "flash")
        _st[b + _L.F.FLASH] = max(0, int(steps))

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

    def blend_get(self):
        return "#%06x" % int(_st[self._b + F.TINT])

    def blend_set(self, color):
        _st[self._b + F.TINT] = _parse_color(color, "image_blend")

    def mode_get(self):
        return _L.BLEND_MODES[int(_st[self._b + F.BLEND])]

    def mode_set(self, mode):
        if mode not in _L.BLEND_MODES:
            raise ValueError(f"blend_mode is one of {', '.join(repr(m) for m in _L.BLEND_MODES)}, not {mode!r}."
                             + _suggest(str(mode), _L.BLEND_MODES))
        _st[self._b + F.BLEND] = _L.BLEND_MODES.index(mode)

    def edge(kind, name):
        # outline and glow are one setting, two looks: setting one replaces the other.
        def get(self):
            b = self._b
            return "#%06x" % int(_st[b + F.OUTLINE_COLOR]) if _st[b + F.OUTLINE] == kind else None

        def set_(self, color):
            b = self._b
            if color is None:
                if _st[b + F.OUTLINE] == kind:
                    _st[b + F.OUTLINE] = 0.0
                return
            _st[b + F.OUTLINE_COLOR] = _parse_color(color, name)
            _st[b + F.OUTLINE] = kind
        return property(get, set_)

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
        "visible": flag(F.VISIBLE), "solid": flag(F.SOLID), "drop_through": plain(F.DROP),
        "ignore_pause": flag(F.UNPAUSED),
        "depth": plain(F.DEPTH),
        "image_blend": property(blend_get, blend_set), "blend_mode": property(mode_get, mode_set),
        "outline": edge(1, "outline"), "glow": edge(2, "glow"),
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
    # Beyond GameMaker's list: colours effects and glows reach for.
    "cyan": 0x00FFFF, "magenta": 0xFF00FF, "pink": 0xFF8FB1, "gold": 0xFFD166, "brown": 0x8B5A2B,
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


def collision_line(x1, y1, x2, y2, obj=None):
    """The first instance (or tile layer's name) the line touches, nearest (x1, y1); None for a clear line."""
    me = _cur._slot if _cur is not None else -1
    c = _js.collision_line(x1, y1, x2, y2, -1 if obj is None else _target_of(obj), me)
    if c >= 0:
        return _objs[c]
    if c <= -2:
        return _tile_layer_names()[-2 - c]
    return None


def path_find(x1, y1, x2, y2, cell=16):
    """The points of a way round everything solid, from (x1, y1) to (x2, y2) — or [] when there is none."""
    cell = _num(cell, "path_find", "cell")
    if cell < 2:
        raise ValueError("path_find: cell is the size of the grid's squares in pixels, 2 or more (16 is usual).")
    me = _cur._slot if _cur is not None else -1
    return [tuple(p) for p in json.loads(_js.path_find(x1, y1, x2, y2, cell, me))]


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


_touch = False      # what touch_controls() last asked for, until it is sent: a dict, None to hide, or False for nothing new


def touch_controls(show=True, buttons=("space", "x"), always=False):
    """
    On-screen controls for a touchscreen: arrows on the left (the arrow keys)
    and a button for each key in `buttons` on the right. Pressing one is
    holding that key, so the game's keyboard_check code works unchanged.
    Shown only on a touchscreen, unless always=True. show=False hides them.
    """
    global _touch
    if not show:
        _touch = None
        return
    keys = [buttons] if isinstance(buttons, str) else list(buttons)
    if len(keys) > 4:
        raise ValueError("touch_controls: up to 4 buttons fit on the screen.")
    for k in keys:
        _key_code(k)
    _touch = {"buttons": [str(k).lower() for k in keys], "always": bool(always)}


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
        _draw_list.append(["sprite", _draw_depth, _sprite_of(sprite), frame, x, y, _alpha])


def draw_text(x, y, text):
    if _check_draw("draw_text"):
        _draw_list.append(["text", _draw_depth, x, y, str(text), _color, _font, _font_size, _alpha, _halign, _valign])


def draw_sprite_ext(sprite, frame, x, y, xscale=1, yscale=1, angle=0, color="white", alpha=1):
    """A frame of a sprite, scaled, turned (degrees, anticlockwise), tinted and faded."""
    if _check_draw("draw_sprite_ext"):
        _draw_list.append(["sprite", _draw_depth, _sprite_of(sprite), frame, x, y,
                           _alpha * max(0.0, min(1.0, _num(alpha, "draw_sprite_ext", "alpha"))),
                           _num(xscale, "draw_sprite_ext", "xscale"), _num(yscale, "draw_sprite_ext", "yscale"),
                           _num(angle, "draw_sprite_ext", "angle"), _parse_color(color, "draw_sprite_ext")])


def draw_line(x1, y1, x2, y2, width=1):
    if _check_draw("draw_line"):
        _draw_list.append(["line", _draw_depth, x1, y1, x2, y2, _color, max(0.0, _num(width, "draw_line", "width")), _alpha])


def draw_circle(x, y, r, outline=False):
    if _check_draw("draw_circle"):
        _draw_list.append(["circle", _draw_depth, x, y, abs(_num(r, "draw_circle", "r")), _color, 1 if outline else 0, _alpha])


def draw_ellipse(x1, y1, x2, y2, outline=False):
    if _check_draw("draw_ellipse"):
        _draw_list.append(["ellipse", _draw_depth, x1, y1, x2, y2, _color, 1 if outline else 0, _alpha])


def draw_triangle(x1, y1, x2, y2, x3, y3, outline=False):
    if _check_draw("draw_triangle"):
        _draw_list.append(["tri", _draw_depth, x1, y1, x2, y2, x3, y3, _color, 1 if outline else 0, _alpha])


def draw_rect_gradient(x1, y1, x2, y2, color1, color2, vertical=True):
    """A rectangle shading from color1 to color2: top to bottom, or left to right with vertical=False."""
    if _check_draw("draw_rect_gradient"):
        _draw_list.append(["grad", _draw_depth, x1, y1, x2, y2, _parse_color(color1, "draw_rect_gradient"),
                           _parse_color(color2, "draw_rect_gradient"), 1 if vertical else 0, _alpha])


_halign = "left"
_valign = "top"


def draw_set_halign(align):
    """Where draw_text's x is: "left" (the default), "center" or "right" of the text."""
    global _halign
    _halign = _named(align, ("left", "center", "right"), "draw_set_halign", "a way to line text up")


def draw_set_valign(align):
    """Where draw_text's y is: "top" (the default), "middle" or "bottom" of the text."""
    global _valign
    _valign = _named(align, ("top", "middle", "bottom"), "draw_set_valign", "a way to line text up")


def string_width(text):
    """How wide draw_text would draw this, in pixels, in the font set now."""
    return _js.text_size(str(text), _font, _font_size, 0)


def string_height(text):
    """How tall draw_text would draw this, in pixels, in the font set now (more lines, taller)."""
    return _js.text_size(str(text), _font, _font_size, 1)


# ---------------------------------------------------------------- small maths

def clamp(value, low, high):
    """value, kept between low and high."""
    return max(low, min(high, value))


def lerp(a, b, t):
    """The point t of the way from a to b: lerp(0, 100, 0.25) is 25."""
    return a + (b - a) * t


def approach(value, target, step):
    """value moved towards target by at most step, never past it: smooth speeding up and slowing down."""
    step = abs(step)
    return min(value + step, target) if value < target else max(value - step, target)


def sign(value):
    """1 for a positive number, -1 for a negative one, 0 for 0."""
    return (value > 0) - (value < 0)


def choose(options):
    """One of a list, picked at random: choose(["red", "green", "blue"])."""
    import random
    options = list(options)
    if not options:
        raise ValueError("choose needs a list with something in it.")
    return random.choice(options)


_font = -1        # index into the game's fonts, or -1 for the built-in one
_font_size = 16
_font_index = {}  # name -> index, from the game's fonts


def draw_set_font(font=None, size=16):
    """Sets the font for draw_text from now on: one from the Fonts folder (None: the built-in one), and its size."""
    global _font, _font_size
    if font is None:
        _font = -1
    elif font in _font_index:
        _font = _font_index[font]
    else:
        known = ", ".join(sorted(_font_index)) or "none yet — add one in the Fonts folder"
        raise NameError(f"There is no font called {font!r}. Fonts: {known}.")
    if not isinstance(size, (int, float)) or size <= 0:
        raise ValueError(f"A font size is a number above 0, like 16, not {size!r}.")
    _font_size = float(size)


def draw_rect(x1, y1, x2, y2, outline=False):
    if _check_draw("draw_rect"):
        _draw_list.append(["rect", _draw_depth, x1, y1, x2, y2, _color, 1 if outline else 0, _alpha])


def _parse_color(color, fn="draw_set_color"):
    """A colour as 0xRRGGBB: a name ("red"), "#rrggbb", an (r, g, b) tuple, or a number."""
    if isinstance(color, str):
        c = color.strip().lower()
        if c.startswith("#") and len(c) == 7:
            try:
                return int(c[1:], 16)
            except ValueError:
                pass
        if c in _COLORS:
            return _COLORS[c]
        raise ValueError(f'"{color}" is not a colour GameIDE knows.' + _suggest(c, _COLORS)
                         + ' Use a name like "red", or "#ff8800".')
    if isinstance(color, tuple) and len(color) == 3:
        r, g, b = (max(0, min(255, int(v))) for v in color)
        return (r << 16) | (g << 8) | b
    if isinstance(color, int) and not isinstance(color, bool):
        return color & 0xFFFFFF
    raise TypeError(f"{fn} wants a colour: a name, \"#rrggbb\" or (r, g, b), not {color!r}")


def draw_set_color(color):
    """A colour name ("red"), "#rrggbb", an (r, g, b) tuple, or 0xRRGGBB."""
    global _color
    _color = _parse_color(color)


def draw_set_alpha(alpha):
    """How solid draw_* calls draw from now on in this event: 1 solid, 0.5 see-through, 0 invisible."""
    global _alpha
    if not isinstance(alpha, (int, float)) or isinstance(alpha, bool):
        raise TypeError(f"draw_set_alpha wants a number from 0 to 1, not {alpha!r}.")
    _alpha = max(0.0, min(1.0, float(alpha)))


# ---------------------------------------------------------------- game feel
# Particles, weather, lighting, screen effects and hit-pause are the engine's
# (engine/effects.ts): per-particle work belongs there. Python only checks
# what the student asked for — in words, at their line — and sends it on with
# the step's commands (`fx`, `lights`). Tweens, dialogue and fades are plain
# Python: a value or two a step, drawn with the ordinary draw commands.

_fx = []             # orders for effects.ts this step
_lights = []         # light() calls this step; none sent is none shining


def _num(v, fn, name):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise TypeError(f"{fn}: {name} should be a number, not {v!r}.")
    return float(v)


def _named(value, names, fn, what):
    if value not in names:
        raise ValueError(f"{fn}: {value!r} isn't {what} GameIDE knows. Try one of: {', '.join(names)}."
                         + _suggest(str(value), names))
    return value


def particles(x, y, count=12, color="white", speed=3, size=3, life=30, gravity=0, spread=360, direction=90,
              shape="square", depth=-1000):
    """A burst of particles at (x, y). color can be a list: each particle picks one."""
    # A list is several colours, one picked per particle; anything else (a tuple included) is one colour.
    colors = [_parse_color(c, "particles") for c in color] if isinstance(color, list) else _parse_color(color, "particles")
    _named(shape, ("square", "circle"), "particles", "a shape")
    _fx.append(["burst", {
        "x": _num(x, "particles", "x"), "y": _num(y, "particles", "y"),
        "count": max(0, min(500, int(_num(count, "particles", "count")))), "color": colors,
        "speed": _num(speed, "particles", "speed"), "size": _num(size, "particles", "size"),
        "life": max(1, int(_num(life, "particles", "life"))), "gravity": _num(gravity, "particles", "gravity"),
        "spread": _num(spread, "particles", "spread"), "direction": _num(direction, "particles", "direction"),
        "shape": shape, "depth": _num(depth, "particles", "depth"),
    }])


def effect(kind, x, y, color=None, scale=1):
    """A ready-made effect at (x, y): "explosion", "sparkle", "dust", "smoke", "confetti" or "hit"."""
    _named(kind, _L.EFFECT_NAMES, "effect", "an effect")
    _fx.append(["effect", kind, _num(x, "effect", "x"), _num(y, "effect", "y"),
                None if color is None else _parse_color(color, "effect"), _num(scale, "effect", "scale")])


def weather(kind=None, amount=1):
    """Rain or snow across the screen until changed: "rain", "snow", or None to stop. amount: 1 some, 3 a storm."""
    if kind is not None:
        _named(kind, _L.WEATHER, "weather", "weather")
    _fx.append(["weather", kind, max(0.0, _num(amount, "weather", "amount"))])


def particles_clear():
    """Removes every particle, and stops the weather."""
    _fx.append(["clear"])
    _fx.append(["weather", None, 1])


def hit_pause(steps=4):
    """Freezes the whole game for a few steps — the little stop that makes a hit feel hard."""
    _js.hit_pause(max(0, int(_num(steps, "hit_pause", "steps"))))


def lighting(darkness=0.8, color="black"):
    """Darkens this room (0 = daylight, 1 = pitch black) except where light() shines."""
    _fx.append(["lighting", max(0.0, min(1.0, _num(darkness, "lighting", "darkness"))), _parse_color(color, "lighting")])


def light(x, y, radius=100, color="white", strength=1):
    """A light at (x, y) for this step — call it every step (in Step) to keep it shining."""
    _lights.append([_num(x, "light", "x"), _num(y, "light", "y"), max(1.0, _num(radius, "light", "radius")),
                    _parse_color(color, "light"), max(0.0, min(1.0, _num(strength, "light", "strength")))])


def screen_effect(name=None):
    """A look for the whole screen: "crt", "vignette", "grayscale", "pixelate", "sepia" — or None for none."""
    if name is not None:
        _named(name, _L.SCREEN_EFFECTS, "screen_effect", "a screen effect")
    _fx.append(["screen", name])


# Easings: how a tween gets from start to end. t goes 0 → 1; most give 0 → 1 too,
# back and elastic overshoot on the way.
_C1 = 1.70158
_C3 = _C1 + 1
_C2 = _C1 * 1.525


def _out_bounce(t):
    n, d = 7.5625, 2.75
    if t < 1 / d:
        return n * t * t
    if t < 2 / d:
        t -= 1.5 / d
        return n * t * t + 0.75
    if t < 2.5 / d:
        t -= 2.25 / d
        return n * t * t + 0.9375
    t -= 2.625 / d
    return n * t * t + 0.984375


_EASES = {
    "linear": lambda t: t,
    "in_quad": lambda t: t * t,
    "out_quad": lambda t: 1 - (1 - t) ** 2,
    "in_out_quad": lambda t: 2 * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 2 / 2,
    "in_cubic": lambda t: t ** 3,
    "out_cubic": lambda t: 1 - (1 - t) ** 3,
    "in_out_cubic": lambda t: 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2,
    "in_sine": lambda t: 1 - math.cos(t * math.pi / 2),
    "out_sine": lambda t: math.sin(t * math.pi / 2),
    "in_out_sine": lambda t: -(math.cos(math.pi * t) - 1) / 2,
    "in_back": lambda t: _C3 * t ** 3 - _C1 * t * t,
    "out_back": lambda t: 1 + _C3 * (t - 1) ** 3 + _C1 * (t - 1) ** 2,
    "in_out_back": lambda t: ((2 * t) ** 2 * ((_C2 + 1) * 2 * t - _C2)) / 2 if t < 0.5
    else ((2 * t - 2) ** 2 * ((_C2 + 1) * (t * 2 - 2) + _C2) + 2) / 2,
    "in_bounce": lambda t: 1 - _out_bounce(1 - t),
    "out_bounce": _out_bounce,
    "out_elastic": lambda t: 0.0 if t <= 0 else 1.0 if t >= 1
    else 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * (2 * math.pi / 3)) + 1,
}


def ease(name, t):
    """An easing's value at t (0 to 1): ease("out_bounce", 0.5). The curves tween() moves along."""
    fn = _EASES.get(name)
    if fn is None:
        _named(name, list(_EASES), "ease", "an easing")
    return float(fn(max(0.0, min(1.0, _num(t, "ease", "t")))))


_tweens = {}   # (id(target), prop) -> [target, prop, start, end, steps, done, ease]


def tween(target, prop, to, steps=30, ease="out_quad"):
    """Moves target.prop smoothly to `to` over `steps` steps: tween(self, "y", 100, 30, "out_bounce")."""
    if not isinstance(prop, str):
        raise TypeError(f'tween: the property is named in quotes, like tween(self, "x", 200), not {prop!r}.')
    if ease not in _EASES:
        _named(ease, list(_EASES), "tween", "an easing")
    try:
        start = getattr(target, prop)
    except AttributeError:
        raise AttributeError(f"tween: {target!r} has no {prop!r} to move.") from None
    start = _num(start, "tween", f"{prop} (now {start!r})")
    setattr(target, prop, start)  # a read-only one says so here, at this line, not later
    _tweens[(id(target), prop)] = [target, prop, start, _num(to, "tween", "to"), max(1, int(_num(steps, "tween", "steps"))), 0, _EASES[ease]]


def tween_stop(target, prop=None):
    """Stops target's tweens (or just the one moving prop), leaving it where it got to."""
    for key in [k for k, t in _tweens.items() if t[0] is target and (prop is None or t[1] == prop)]:
        del _tweens[key]


def _step_tweens():
    for key, t in list(_tweens.items()):
        target = t[0]
        if isinstance(target, GameObject) and not target._alive:
            del _tweens[key]
            continue
        t[5] += 1
        k = min(1.0, t[5] / t[4])
        setattr(target, t[1], t[3] if k >= 1 else t[2] + (t[3] - t[2]) * t[6](k))
        if k >= 1:
            del _tweens[key]


# Dialogue: say() queues lines; a box at the bottom of the screen types each
# one out, and Space, Enter or a click shows it all, then goes on.
_dialogue = []    # [(name or None, text)]
_dlg_chars = 0.0
_dlg_age = 0      # steps the current line has been up: the key that said it doesn't also skip it


def say(text, name=None):
    """Shows text in a box at the bottom of the screen, typed out. Space, Enter or a click goes on."""
    _dialogue.append((None if name is None else str(name), str(text)))


def dialogue_open():
    """True while say() has something on screen: a good time to stop the player moving."""
    return bool(_dialogue)


def dialogue_clear():
    """Closes the dialogue box and forgets lines still waiting."""
    global _dlg_chars, _dlg_age
    _dialogue.clear()
    _dlg_chars = 0.0
    _dlg_age = 0


def _wrap(text, width):
    out = []
    for para in text.split("\n"):
        line = ""
        for word in para.split(" "):
            if line and len(line) + 1 + len(word) > width:
                out.append(line)
                line = word
            else:
                line = f"{line} {word}" if line else word
        out.append(line)
    return out


_fade = [0.0, 0.0, 0.0, 0, 1, 0]   # value, from, to, steps done, steps, colour
_sflash = [0, 0, 0xFFFFFF]         # steps left, steps, colour


def screen_fade(to=1.0, steps=30, color="black"):
    """Fades the screen to a colour (to=1) or back (to=0) over `steps` steps. Lasts across rooms."""
    _fade[1] = _fade[0]
    _fade[2] = max(0.0, min(1.0, _num(to, "screen_fade", "to")))
    _fade[3] = 0
    _fade[4] = max(1, int(_num(steps, "screen_fade", "steps")))
    _fade[5] = _parse_color(color, "screen_fade")


def screen_flash(color="white", steps=8):
    """Flashes the whole screen a colour, fading out over `steps` steps."""
    _sflash[0] = _sflash[1] = max(1, int(_num(steps, "screen_flash", "steps")))
    _sflash[2] = _parse_color(color, "screen_flash")


def _overlays():
    """After Draw GUI: the dialogue box, then flashes and fades over everything."""
    global _dlg_chars, _dlg_age
    w = view_width or room_width
    h = view_height or room_height
    if _dialogue:
        name, text = _dialogue[0]
        go = _dlg_age > 0 and (keyboard_check_pressed("space") or keyboard_check_pressed("enter") or mouse_check_pressed("left"))
        if go and _dlg_chars < len(text):
            _dlg_chars = len(text)
        elif go:
            _dialogue.pop(0)
            _dlg_chars = 0.0
            _dlg_age = 0
        else:
            _dlg_chars = min(len(text), _dlg_chars + 1)
            _dlg_age += 1
    if _dialogue:
        name, text = _dialogue[0]
        lines = _wrap(text[: int(_dlg_chars)], max(12, int((w - 56) / 8.6)))
        all_lines = _wrap(text, max(12, int((w - 56) / 8.6)))
        top = h - 20 - 24 * len(all_lines) - (26 if name else 12)
        d = -1e6
        _gui.append(["rect", d, 12, top, w - 12, h - 12, 0x10141F, 0, 0.9])
        _gui.append(["rect", d + 0.1, 12, top, w - 12, h - 12, 0xFFFFFF, 1, 0.85])
        y = top + 10
        if name:
            _gui.append(["text", d - 0.1, 26, y, name, 0xFFD166, -1, 16, 1.0])
            y += 24
        if lines:
            _gui.append(["text", d - 0.1, 26, y, "\n".join(lines), 0xFFFFFF, -1, 16, 1.0])
        if _dlg_chars >= len(text) and (_step_count // 20) % 2 == 0:
            _gui.append(["text", d - 0.1, w - 34, h - 36, "▼", 0xFFD166, -1, 14, 1.0])
    if _sflash[0] > 0:
        _gui.append(["rect", -2e6, 0, 0, w, h, _sflash[2], 0, 0.85 * _sflash[0] / _sflash[1]])
        _sflash[0] -= 1
    if _fade[3] < _fade[4]:
        _fade[3] += 1
        _fade[0] = _fade[1] + (_fade[2] - _fade[1]) * (_fade[3] / _fade[4])
    if _fade[0] > 0:
        _gui.append(["rect", -3e6, 0, 0, w, h, _fade[5], 0, _fade[0]])


def room_goto(room):
    """Changes room at the end of this step, as GameMaker does."""
    global _pending_room
    for i, r in enumerate(_rooms):
        if r["name"] == room:
            _pending_room = i
            return
    raise NameError(f'There is no room called "{room}".' + _suggest(str(room), [r["name"] for r in _rooms]))


def room_restart():
    global _pending_room, _restarting_room
    _pending_room = _room_now
    _restarting_room = True   # a persistent room starts afresh, not as it was left


def game_restart():
    global _pending_room
    _pending_room = "restart"


def game_pause(paused=True):
    """
    Stops the game (or starts it again, with False): nothing moves, animates,
    counts down or collides, and Step and key events run only for instances
    with ignore_pause = True — a pause menu. Everything is still drawn.
    """
    _g[_L.G.PAUSED] = 1.0 if paused else 0.0


def game_paused():
    """Is the game paused (game_pause)?"""
    return _g[_L.G.PAUSED] == 1


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


def camera_zoom(zoom=1, steps=0):
    """Zooms the view about its middle: 2 shows half as much, twice the size; 1 is as drawn. Over `steps` steps, or at once."""
    zoom = _num(zoom, "camera_zoom", "zoom")
    if zoom <= 0:
        raise ValueError("camera_zoom: zoom is above 0 — 2 is closer, 0.5 further out, 1 as drawn.")
    _js.camera_zoom(zoom, max(0, int(_num(steps, "camera_zoom", "steps"))))


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


# ---------------------------------------------------------------- sound
#
# The game runs in a worker, where browsers have no audio, so Python only
# says what to play: each frame's orders go out with its other commands
# (_commands) and the page plays them (editor/sound.ts). The page measured
# every sound before the game started, so whether one is still playing is
# worked out here, from when it started and how long it is — nothing has
# to come back from the page.

_sound_length = {}   # name -> seconds
_sound_orders = []   # this frame's orders for the page
_playing = {}        # name -> [step each play ends at, or None while looping]
_music = None        # the name of the music playing, or None
_steps_per_second = 60
_step_count = 0


def _sound(sound):
    if isinstance(sound, str) and sound in _sound_length:
        return sound
    known = ", ".join(sorted(_sound_length)) or "none yet — add one in the Sounds folder"
    raise NameError(f"There is no sound called {sound!r}. Sounds: {known}.")


def _volume(volume):
    if not isinstance(volume, (int, float)) or not 0 <= volume <= 1:
        raise ValueError(f"A volume is from 0 (silent) to 1 (full), not {volume!r}.")
    return float(volume)


def sound_play(sound, loop=False, volume=1):
    """Plays a sound from the Sounds folder. loop=True plays it until sound_stop."""
    name, vol = _sound(sound), _volume(volume)
    _sound_orders.append(["play", name, 1 if loop else 0, vol])
    ends = None if loop else _step_count + max(1, round(_sound_length[name] * _steps_per_second))
    _playing.setdefault(name, []).append(ends)


def sound_stop(sound=None):
    """Stops a sound wherever it is playing — or, with none named, every sound (not the music)."""
    if sound is None:
        _sound_orders.append(["stop_all"])
        _playing.clear()
    else:
        name = _sound(sound)
        _sound_orders.append(["stop", name])
        _playing.pop(name, None)


def sound_playing(sound):
    name = _sound(sound)
    if _music == name:
        return True
    return any(end is None or end > _step_count for end in _playing.get(name, []))


def music_play(sound, loop=True, volume=1):
    """Plays a sound as the music: only one at a time, so it replaces any music playing."""
    global _music
    name, vol = _sound(sound), _volume(volume)
    _sound_orders.append(["music", name, 1 if loop else 0, vol])
    _music = name if loop else None


def music_stop():
    global _music
    _sound_orders.append(["music_stop"])
    _music = None


# ---------------------------------------------------------------- gamepads

_PAD_BUTTONS = {}   # name -> index, from layout.ts


def _pad(pad):
    if not isinstance(pad, int) or not 0 <= pad < _L.PAD_COUNT:
        raise ValueError(f"Gamepads are numbered 0 to {_L.PAD_COUNT - 1}, not {pad!r}.")
    return pad


def _pad_button(button):
    if button in _PAD_BUTTONS:
        return _PAD_BUTTONS[button]
    raise NameError(f"There is no gamepad button called {button!r}. Buttons: {', '.join(_L.PAD_BUTTONS)}.")


def gamepad_check(button, pad=0):
    """Is this button held on that gamepad? "a", "b", "x", "y", "lb", "rb", "lt", "rt", "start", "up"…"""
    return _g[_L.G.PAD_DOWN + _pad(pad) * len(_L.PAD_BUTTONS) + _pad_button(button)] == 1


def gamepad_check_pressed(button, pad=0):
    return _g[_L.G.PAD_PRESSED + _pad(pad) * len(_L.PAD_BUTTONS) + _pad_button(button)] == 1


def gamepad_check_released(button, pad=0):
    return _g[_L.G.PAD_RELEASED + _pad(pad) * len(_L.PAD_BUTTONS) + _pad_button(button)] == 1


def gamepad_axis(axis, pad=0):
    """How far a stick is pushed, -1 to 1: "left_x", "left_y", "right_x", "right_y" (down is +)."""
    if axis not in _L.PAD_AXES:
        raise NameError(f"There is no gamepad axis called {axis!r}. Axes: {', '.join(_L.PAD_AXES)}.")
    return _g[_L.G.PAD_AXIS + _pad(pad) * len(_L.PAD_AXES) + _L.PAD_AXES.index(axis)]


def gamepad_connected(pad=0):
    return _g[_L.G.PAD_CONNECTED + _pad(pad)] == 1


# ---------------------------------------------------------------- save files
#
# What a game keeps between plays — progress, high scores — in the
# player's browser. The page hands the saved data over as the game starts;
# a change goes out with the frame's commands (whole: it is small) and the
# page stores it. Values are copied in and out through JSON, so a list
# changed after saving doesn't change the save behind the game's back.

SAVE_LIMIT = 1_000_000  # characters of JSON
_save = {}
_save_changed = False


def save_set(key, value):
    """Keeps a value (number, text, True/False, None, or a list/dict of those) under a name, for next time."""
    global _save_changed
    if not isinstance(key, str):
        raise TypeError(f"A save name is text, like save_set(\"best\", 10), not {key!r}.")
    try:
        text = json.dumps(value)
    except (TypeError, ValueError):
        raise TypeError(f"save_set can keep numbers, text, True/False, None and lists or dicts of those — not {value!r}.") from None
    if len(json.dumps(_save)) + len(text) > SAVE_LIMIT:
        raise ValueError("There's too much saved: a game can keep about 1 MB. Save less, or save_delete what isn't needed.")
    _save[key] = json.loads(text)
    _save_changed = True


def save_get(key, default=None):
    """A value kept with save_set — or `default` if nothing was saved under that name."""
    return json.loads(json.dumps(_save[key])) if key in _save else default


def save_delete(key):
    global _save_changed
    if key in _save:
        del _save[key]
        _save_changed = True


def save_clear():
    global _save_changed
    _save.clear()
    _save_changed = True


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


def _call_unpaused(lst, name):
    """_call_all for a paused game: only the instances with ignore_pause set."""
    global _cur
    unpaused = _L.F.UNPAUSED
    for i in range(len(lst)):
        o = lst[i]
        if o._alive and _st[o._b + unpaused]:
            _cur = o
            getattr(o, name)()
    _cur = None


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


def _new_slot():
    """A free slot in the shared array: one given back, or a new one (growing the arrays when full)."""
    global _next
    if _free:
        return _free.pop()
    slot = _next
    if slot >= _capacity:
        _grow()
    _next += 1
    _g[_L.G.SLOTS] = _next
    return slot


def _create(t, x, y, placed=None):
    """A new instance. `placed` is a room instance's overrides (scale,
    angle), applied before its Create event as GameMaker does."""
    slot = _new_slot()
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
    _prune()


def _prune():
    """Takes instances that are no longer alive (destroyed, or parked by a persistent room) off every list."""
    global _all
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


# Persistent rooms (RoomDef.persistent): a room left is kept here, by its
# index, as its instances — the same Python objects, so references between
# them still work — with each one's built-in state, and its tile layers as
# they were. Going back puts them in again instead of building the room
# from the room editor's instances. room_restart() starts one afresh.
_parked = {}
_restarting_room = False
_tiles_back = None   # a parked room's tiles, sent to the engine with this frame's commands


def _park(o):
    """
    Takes an instance out of the game without ending it (no Destroy, no
    Clean Up): its persistent room keeps it. While parked it is a ghost like a
    destroyed instance — its slot belongs to someone else now — so a
    reference kept elsewhere reads where it was, not another instance's x.
    """
    b = o._b
    state = _st[b:b + STRIDE]
    values = {name: getattr(o, name) for name in _BUILTIN_PROPS if name not in ("alarm",)}
    o._alive = False
    _st[b + _F_ALIVE] = 0.0
    _mark_dirty(o._slot, b)
    _objs[o._slot] = None
    _free.append(o._slot)
    o._slot = -1
    o.__class__ = _ghost(type(o))
    o.__dict__.update(values)
    return state


def _unpark(o, state):
    """Puts a parked instance back in the game as it was: its own class, a slot, and its state."""
    ty = _types[o._t]
    for name in _BUILTIN_PROPS:
        o.__dict__.pop(name, None)
    o.__class__ = ty.cls
    slot = _new_slot()
    b = slot * STRIDE
    gen = _st[b + _L.F.GEN] + 1
    was_dirty = _st[b + _F_DIRTY]
    _st[b:b + STRIDE] = state
    _st[b + _L.F.GEN] = gen
    _st[b + _F_DIRTY] = was_dirty
    _st[b + _F_ALIVE] = 1.0
    o._slot, o._b, o._alive = slot, b, True
    _mark_dirty(slot, b)
    _objs[slot] = o
    _all.append(o)
    _by_type[o._t].append(o)
    for name in ty.per_frame:
        _lists[name].append(o)


def _goto(index, first=False):
    """Leaves the current room (if any) and builds room `index` — or, for a persistent room left before, puts it back."""
    global _room_now, _room_changed, room_width, room_height, _cur, _restarting_room, _tiles_back
    if _room_now >= 0:
        for o in list(_all):
            if o._alive:
                _call(o, "on_room_end")
        keep = _rooms[_room_now].get("persistent") and not _restarting_room
        kept = []
        for o in list(_all):
            if o._alive and not _types[o._t].persistent:
                if keep:
                    kept.append((o, _park(o)))
                else:
                    _kill_quietly(o)
        if keep:
            _parked[_room_now] = (kept, json.loads(_js.tiles_get()))
        else:
            _parked.pop(_room_now, None)
        _reap()
        # _reap only tidies when something was destroyed: parked instances
        # must leave the lists too, or coming back would list them twice.
        _prune()
    _restarting_room = False
    room = _rooms[index]
    _room_now = index
    _room_changed = True
    room_width = room["width"]
    room_height = room["height"]
    _g[_L.G.ROOM_WIDTH] = room_width
    _g[_L.G.ROOM_HEIGHT] = room_height
    _publish_globals()
    back = _parked.pop(index, None)
    if back is not None:
        # A persistent room as it was left: no Create events, no creation code.
        for o, state in back[0]:
            _unpark(o, state)
        _tiles_back = back[1]
    # GameMaker's order: each instance's Create then its creation code, then
    # Game Start (first room only), then Room Start.
    for i, inst in enumerate(room["instances"] if back is None else []):
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
    global _room_now, _music
    # Starting again silences the old game: its sounds and music stop.
    _sound_orders.append(["stop_all"])
    _sound_orders.append(["music_stop"])
    _playing.clear()
    _music = None
    for o in list(_all):
        _kill_quietly(o)
    _reap()
    _parked.clear()   # every room afresh
    _g[_L.G.PAUSED] = 0.0
    global_vars.__dict__.clear()
    # The game's feel starts over too: no tweens, lines, fades or effects left from the last go.
    _tweens.clear()
    dialogue_clear()
    _fade[:] = [0.0, 0.0, 0.0, 0, 1, 0]
    _sflash[0] = 0
    _fx.append(["screen", None])
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


def _input_events(paused=False):
    """Keyboard and global mouse events, for the instances that have any (paused: that ignore the pause)."""
    global _cur
    keys = _keys
    lst = _lists["keyboard"]
    for i in range(len(lst)):
        o = lst[i]
        if not o._alive or (paused and not _st[o._b + _L.F.UNPAUSED]):
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
        if not o._alive or (paused and not _st[o._b + _L.F.UNPAUSED]):
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
    global _in_draw, _draw_depth, _cur, _color, _draw_list, _alpha, _halign, _valign
    for name, target in (("on_draw", _draw), ("on_draw_gui", _gui)):
        lst = _lists[name]
        if not lst:
            continue
        _in_draw = True
        _draw_list = target
        _color = 0xFFFFFF
        _alpha = 1.0
        _halign, _valign = "left", "top"
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
    global _draw, _gui, _debug_changed, _room_changed, _save_changed, _tiles_back, _touch
    out = {}
    if _touch is not False:
        out["touch"] = _touch
        _touch = False
    if _tiles_back is not None:
        out["tiles"] = _tiles_back
        _tiles_back = None
    if _fx:
        out["fx"] = list(_fx)
        _fx.clear()
    if _lights:
        out["lights"] = list(_lights)
        _lights.clear()
    if _sound_orders:
        out["sounds"] = list(_sound_orders)
        _sound_orders.clear()
    if _save_changed:
        out["save"] = _save
        _save_changed = False
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
    global _cur, _in_draw, _step_count
    try:
        _step_count += 1
        _publish_globals()
        # Paused (game_pause): only instances that ignore the pause run their
        # events; the engine holds everyone else still. Tweens wait too.
        paused = _g[_L.G.PAUSED] == 1
        run = _call_unpaused if paused else _call_all
        if not paused:
            _step_tweens()
        run(_lists["on_begin_step"], "on_begin_step")
        _dispatch_engine_events()        # alarms and mouse-on-instance
        _input_events(paused)
        run(_lists["on_step"], "on_step")
        _js_motion()                     # engine: move, animate, collide
        _dispatch_engine_events()        # collisions, animation end, outside room
        run(_lists["on_end_step"], "on_end_step")
        _draw_events()
        _overlays()
        _end_of_frame()
        return _commands()
    except (Exception, KeyboardInterrupt) as e:  # noqa: BLE001 — every student error must reach the IDE
        _cur = None
        _in_draw = False
        return _error_json(e)


def _inspect(slot):
    """
    The debugger's look at a running game (Debug, then click an instance):
    one instance's built-in properties and its own variables, and
    global_vars, as JSON with every value as repr. Long values are cut short.
    """
    def show(v):
        r = repr(v)
        return r if len(r) <= 80 else r[:77] + "..."
    out = {"globals": {k: show(v) for k, v in sorted(vars(global_vars).items()) if not k.startswith("_")}}
    o = _objs[slot] if 0 <= slot < len(_objs) else None
    if o is not None and o._alive:
        props = {name: show(getattr(o, name)) for name in _BUILTIN_PROPS if name not in ("alarm", "object_name")}
        props["alarm"] = show([_st[o._b + _L.F.ALARM0 + i] for i in range(_L.ALARM_COUNT)])
        out.update(object=_types[o._t].name, slot=slot, props=props,
                   vars={k: show(v) for k, v in o.__dict__.items() if not k.startswith("_")})
    return json.dumps(out)


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


def _quotes_hint(e):
    """
    room_goto(Level2) instead of room_goto("Level2"): the commonest slip of
    all, because objects *are* Python names (each is a class) while rooms,
    sprites, sounds and fonts are only text. Python's own message, "name
    'Level2' is not defined", is true and no help; this says what it is.
    """
    name = getattr(e, "name", None)
    if not isinstance(e, NameError) or not isinstance(name, str):
        return ""
    for kind, names in (("room", [r["name"] for r in _rooms]), ("sprite", _sprite_names),
                        ("sound", _sound_length), ("font", _font_index)):
        if name in names:
            return (f"\n{name} is a {kind}. A {kind} is named in quotes, as text: "
                    f'"{name}" — for example {_QUOTE_EXAMPLE[kind].format(name)}.')
    return ""


_QUOTE_EXAMPLE = {
    "room": 'room_goto("{}")',
    "sprite": 'self.sprite = "{}"',
    "sound": 'sound_play("{}")',
    "font": 'draw_set_font("{}")',
}


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
        message = "".join(traceback.format_exception_only(type(e), e)).strip() + _quotes_hint(e)
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
    global _steps_per_second, _save, _font, _step_count, _music
    _steps_per_second = game.get("stepsPerSecond") or 60
    _step_count = 0
    _music = None
    _playing.clear()
    _sound_orders.clear()
    _sound_length.clear()
    for snd in game.get("sounds", []):
        _sound_length[snd["name"]] = snd.get("duration", 0)
    _font_index.clear()
    for i, f in enumerate(game.get("fonts", [])):
        _font_index[f["name"]] = i
    _font = -1
    _save = json.loads(json.dumps(game.get("save") or {}))
    _PAD_BUTTONS.clear()
    _PAD_BUTTONS.update({b: i for i, b in enumerate(_L.PAD_BUTTONS)})
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
        tpl[F.TINT] = 0xFFFFFF  # image_blend white: the sprite as drawn
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
