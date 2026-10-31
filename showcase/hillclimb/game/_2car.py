# script: car
# The car, and the physics that drives it: plain Python, no physics engine.
#
# The body is one rigid box: a position, a speed, an angle and a spin. Each
# wheel is a circle with its own position and speed, held under the body by
# a spring (the suspension). Each step is cut into SUB small steps, and in
# each one:
#   1. gravity pulls everything down;
#   2. each spring pushes its wheel and the body apart (or pulls them
#      together), and a push on the body away from its middle turns it;
#   3. a wheel touching the road is pushed out of it, and the engine drives
#      it along the road (as far as the tyres grip) or the brake holds it;
#   4. in the air, gas tips the car back and brake tips it forward;
#   5. if a corner of the body digs into the road it bounces off, and if
#      the driver's head touches the road, the run is over.
#
# Pixels and steps throughout (60 steps a second). The angle is in radians,
# and 0 is level; less than 0 is nose up.
import math

SUB = 4              # small steps in each step: more is steadier, but slower
SIDE_SPRING = 0.8    # how firmly a wheel is held under its corner (front to back)
SIDE_DAMPING = 0.3
STOP_SPRING = 0.6    # the bump stop at the end of the suspension's travel
WHEEL_BOUNCE = 0.1   # how much a wheel bounces when it hits the road
BODY_BOUNCE = 0.2
TOUCH = 0.6          # a wheel this close to the road (pixels) is touching it
SPIN_DRAG = 0.995    # the car's spin, kept each small step in the air

# Each vehicle: its weight, where its wheels are (from the middle of the
# body, x forward and y down), how big they are, its body's corners, the
# driver's head (x, y and radius), and its engine and springs.
VEHICLES = {
    "Jeep": {"price": 0, "mass": 1.0, "wheel_mass": 0.25, "wheel_r": 13,
             "wheels": [(-24, 14), (25, 14)], "body": (-36, -12, 36, 8), "head": (-6, -27, 8),
             "power": 0.085, "top": 7.0, "brake": 0.12, "spring": 0.05, "damping": 0.05, "travel": 9,
             "grip": 1.0, "tank": 100, "tilt": 0.0022, "burn": 0.1},
    "Truck": {"price": 2500, "mass": 1.5, "wheel_mass": 0.4, "wheel_r": 18,
              "wheels": [(-30, 18), (30, 18)], "body": (-44, -14, 44, 8), "head": (-8, -32, 9),
              "power": 0.10, "top": 7.5, "brake": 0.14, "spring": 0.06, "damping": 0.07, "travel": 12,
              "grip": 1.15, "tank": 130, "tilt": 0.0018, "burn": 0.12},
}

# Upgrades, bought in the garage. Each level adds `step` to the stat (a
# share of the vehicle's own: 0.12 is 12% more), and costs the next price.
UPGRADES = {
    "engine":     {"stat": "power",  "step": 0.12, "prices": [150, 300, 600, 1000, 1600]},
    "suspension": {"stat": "spring", "step": 0.15, "prices": [100, 250, 500, 800, 1200]},
    "tires":      {"stat": "grip",   "step": 0.10, "prices": [120, 280, 550, 900, 1400]},
    "fuel tank":  {"stat": "tank",   "step": 0.20, "prices": [100, 200, 400, 700, 1000]},
}


def car_stats(kind, levels):
    """The vehicle's numbers with its upgrades: `levels` is like {"engine": 2}."""
    stats = dict(VEHICLES[kind])
    for name, up in UPGRADES.items():
        n = levels.get(name, 0)
        stats[up["stat"]] = stats[up["stat"]] * (1 + up["step"] * n)
        if name == "engine":
            stats["top"] = stats["top"] * (1 + 0.05 * n)      # a bigger engine is a little faster, too
        if name == "suspension":
            stats["damping"] = stats["damping"] * (1 + up["step"] * n)
            stats["travel"] = stats["travel"] + n
    return stats


class Wheel:
    def __init__(self, mount, r, x, y):
        self.mount = mount               # where it hangs from, on the body
        self.r = r
        self.x, self.y = x, y
        self.vx = self.vy = 0.0
        self.spin = 0.0                  # its turn, for drawing
        self.turn = 0.0                  # how fast it turns
        self.on = False                  # touching the road (this step)
        self.tx, self.ty = 1.0, 0.0      # along the road where it touches


class Car:
    def __init__(self, kind, levels, road, x):
        s = car_stats(kind, levels)
        self.kind, self.stats = kind, s
        self.mass = s["mass"]
        bx1, by1, bx2, by2 = s["body"]
        w, h = bx2 - bx1, by2 - by1
        self.inertia = self.mass * (w * w + h * h) / 12
        self.x = x
        self.y = ground_y(road, x) - s["wheel_r"] - s["wheels"][0][1] - 2
        self.vx = self.vy = 0.0
        self.a = 0.0                     # angle (radians; less than 0 is nose up)
        self.w = 0.0                     # how fast it turns
        self.wheels = [Wheel(m, s["wheel_r"], x + m[0], self.y + m[1]) for m in s["wheels"]]
        self.fuel = s["tank"]
        self.head_hit = False
        self.touching = False            # anything touching the road this step
        self.air = 0                     # steps since anything touched the road
        self.air_spin = 0.0              # how far it has turned since it left the road
        self.scrape = False              # a corner of the body dug in this step

    def to_world(self, lx, ly):
        c, s = math.cos(self.a), math.sin(self.a)
        return self.x + lx * c - ly * s, self.y + lx * s + ly * c

    def head(self):
        hx, hy, r = self.stats["head"]
        x, y = self.to_world(hx, hy)
        return x, y, r

    def speed(self):
        """Speed along the way it's going, in pixels a step (less than 0 going backwards)."""
        return self.vx * math.cos(self.a) + self.vy * math.sin(self.a)


def nearest_road(road, px, py, r):
    """The point of the road nearest (px, py), looking `r` either side:
    (distance, its x, its y, below) — below is True if (px, py) is under the road."""
    hs = road["heights"]
    best = None
    i0 = max(0, int((px - r) // STEP))
    i1 = min(len(hs) - 2, int((px + r) // STEP))
    for i in range(i0, i1 + 1):
        ax, ay, by = i * STEP, hs[i], hs[i + 1]
        dy = by - ay
        t = ((px - ax) * STEP + (py - ay) * dy) / (STEP * STEP + dy * dy)
        t = 0 if t < 0 else 1 if t > 1 else t
        cx, cy = ax + STEP * t, ay + dy * t
        d = math.hypot(px - cx, py - cy)
        if best is None or d < best[0]:
            best = (d, cx, cy)
    if best is None:
        return None
    return best + (py > ground_y(road, px),)


def car_step(car, gas, brake, stage, road):
    """One step of the car, with the gas and brake pedals as pressed (True or False)."""
    if car.fuel <= 0:
        gas = False
    if gas:
        car.fuel = max(0.0, car.fuel - car.stats["burn"])
    for w in car.wheels:
        w.on = False
    car.touching = car.scrape = False
    for _ in range(SUB):
        small_step(car, gas, brake, stage, road, 1 / SUB)
    if car.touching:
        car.air = 0
    else:
        car.air += 1
        car.air_spin += car.w


def small_step(car, gas, brake, stage, road, dt):
    s = car.stats
    g = stage["gravity"]
    m, wm = car.mass, s["wheel_mass"]
    total = m + wm * len(car.wheels)
    ca, sa = math.cos(car.a), math.sin(car.a)

    # 1. Gravity.
    car.vy += g * dt
    for w in car.wheels:
        w.vy += g * dt

    # 2. The springs, between each wheel and its corner of the body.
    for w in car.wheels:
        lx, ly = w.mount
        rx, ry = lx * ca - ly * sa, lx * sa + ly * ca        # the corner, from the body's middle
        mvx, mvy = car.vx - car.w * ry, car.vy + car.w * rx  # how fast the corner moves
        ex, ey = w.x - car.x - rx, w.y - car.y - ry          # how far the wheel is from it
        dvx, dvy = w.vx - mvx, w.vy - mvy
        down = -ex * sa + ey * ca                            # along the body's "down"...
        side = ex * ca + ey * sa                             # ...and along its length
        f_down = -s["spring"] * down - s["damping"] * (-dvx * sa + dvy * ca)
        if down > s["travel"]:
            f_down -= STOP_SPRING * (down - s["travel"])
        elif down < -s["travel"]:
            f_down -= STOP_SPRING * (down + s["travel"])
        f_side = -SIDE_SPRING * side - SIDE_DAMPING * (dvx * ca + dvy * sa)
        fx, fy = -f_down * sa + f_side * ca, f_down * ca + f_side * sa
        w.vx += fx / wm * dt
        w.vy += fy / wm * dt
        car.vx -= fx / m * dt
        car.vy -= fy / m * dt
        car.w -= (rx * fy - ry * fx) / car.inertia * dt

    # 3. The wheels on the road: pushed out of it, then driven along it.
    grip = s["grip"] * stage["grip"]
    for w in car.wheels:
        near = nearest_road(road, w.x, w.y, w.r)
        if near is None:
            continue
        d, cx, cy, below = near
        # A wheel resting on the road sits exactly on it, and a small step of
        # gravity lifts it off and back every other small step: so "touching"
        # allows a hair's gap (TOUCH), or the engine pushed half the time.
        if d >= w.r + TOUCH and not below:
            w.turn *= 0.995
            if gas:
                w.turn = min(w.turn + 0.02, s["top"] / w.r)
            w.spin += w.turn * dt
            continue
        if d < 0.001:
            nx, ny = 0.0, -1.0
        else:
            nx, ny = (w.x - cx) / d, (w.y - cy) / d
        if below:                                            # the middle has gone under: out the top
            nx, ny, d = -nx, -ny, -d
        dig = w.r - d
        if dig > 0:
            w.x += nx * dig
            w.y += ny * dig
        vn = w.vx * nx + w.vy * ny
        if vn < 0:
            w.vx -= (1 + WHEEL_BOUNCE) * vn * nx
            w.vy -= (1 + WHEEL_BOUNCE) * vn * ny
        w.on = car.touching = True
        tx, ty = -ny, nx                                     # along the road, forwards
        w.tx, w.ty = tx, ty
        vt = w.vx * tx + w.vy * ty
        most = grip * g * max(0.2, -ny)                      # the most the tyres can push: less on a slope, and on the moon
        if gas:
            push = s["power"] * max(0.0, 1 - vt / s["top"])
        elif brake:
            if vt > 0.05:
                push = -min(s["brake"], vt / dt)
            elif vt < -1.5:
                push = min(s["brake"], -vt / dt)                 # rolling back too fast: it brakes
            else:
                push = -s["power"] * 0.6 * max(0.0, 1 + vt / 1.5)   # stopped: backing up, slowly
        else:
            push = -vt * 0.004                               # rolling, it slows a little
        push = max(-most, min(most, push))
        k = push * total / len(car.wheels) / wm * dt          # each wheel pushes its share of the car
        w.vx += tx * k
        w.vy += ty * k
        w.turn = (w.vx * tx + w.vy * ty) / w.r
        w.spin += w.turn * dt

    # 4. Gas tips the car back and brake tips it forward: a lot in the air, a little on the road.
    lean = s["tilt"] * (1 if not car.touching else 0.25)
    if gas:
        car.w -= lean * dt
    if brake:
        car.w += lean * dt
    if not car.touching:
        car.w *= SPIN_DRAG

    # Everything moves.
    car.x += car.vx * dt
    car.y += car.vy * dt
    car.a += car.w * dt
    for w in car.wheels:
        w.x += w.vx * dt
        w.y += w.vy * dt

    # 5. The body's corners against the road, and the driver's head.
    bx1, by1, bx2, by2 = s["body"]
    for lx, ly in ((bx1, by1), (bx2, by1), (bx1, by2), (bx2, by2)):
        px, py = car.to_world(lx, ly)
        dig = py - ground_y(road, px)
        if dig > 0:
            body_bounce(car, px, py, dig, road)
    hx, hy, hr = car.head()
    near = nearest_road(road, hx, hy, hr)
    if near and (near[0] < hr or near[3]):
        car.head_hit = True


def body_bounce(car, px, py, dig, road):
    """A corner of the body has dug `dig` pixels into the road: it bounces off, and scrapes."""
    i = int(px // STEP)
    hs = road["heights"]
    i = max(0, min(len(hs) - 2, i))
    dy = hs[i + 1] - hs[i]
    n = math.hypot(STEP, dy)
    nx, ny = dy / n, -STEP / n                               # straight up out of the road
    rx, ry = px - car.x, py - car.y
    vx, vy = car.vx - car.w * ry, car.vy + car.w * rx        # how fast that corner moves
    vn = vx * nx + vy * ny
    car.x += nx * dig * -ny * 0.8
    car.y += ny * dig * -ny * 0.8
    car.touching = car.scrape = True
    if vn >= 0:
        return
    rn = rx * ny - ry * nx
    j = -(1 + BODY_BOUNCE) * vn / (1 / car.mass + rn * rn / car.inertia)
    # Friction along the road, as much as the push allows.
    tx, ty = -ny, nx
    vt = vx * tx + vy * ty
    rt = rx * ty - ry * tx
    jt = -vt / (1 / car.mass + rt * rt / car.inertia)
    jt = max(-0.5 * j, min(0.5 * j, jt))
    ix, iy = nx * j + tx * jt, ny * j + ty * jt
    car.vx += ix / car.mass
    car.vy += iy / car.mass
    car.w += (rx * iy - ry * ix) / car.inertia
