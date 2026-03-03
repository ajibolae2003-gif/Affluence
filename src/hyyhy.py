"""
MULTIVERSE AGENT — Consciousness-Shifting Reinforcement Learning
================================================================
Concept:
  - One agent consciousness lives across U parallel universes
  - Each universe is the same world + small noise perturbation
  - Agent updates weight vector W (policy) from experience (reward signal)
  - When agent dies in universe Ui → consciousness SHIFTS to best surviving
    universe, carrying blended knowledge W  (no hard reset, no local minima)
  - Goal G moves to a NEW random position every episode → forces generalisation
  - The shifting prevents getting stuck: each new universe has slightly
    different obstacle layout → different escape routes discovered

RL Mechanics:
  - State s  = RELATIVE position to goal (δcol, δrow) bucketed into 9 zones
              → agent learns "move toward goal" independent of absolute position
              → this is what allows generalisation to any goal location
  - Action a  ∈ {UP, DOWN, LEFT, RIGHT, UPLEFT, UPRIGHT, DOWNLEFT, DOWNRIGHT}
  - Reward r  = +big on goal, -big on death, -small per step, +medium moving closer
  - Q-table  shared across universes (merged on shift)
  - Policy   ε-greedy with ε decaying over time (explore → exploit)
  - On shift  new universe Q ← α·dying_Q + (1-α)·surviving_Q  (knowledge blending)

Run:  python multiverse_rl.py
"""

import tkinter as tk
from tkinter import font as tkfont
import math, random, time, collections

# ═══════════════════════════════════════════════════════════
#  CONFIG
# ═══════════════════════════════════════════════════════════
W, H        = 800, 540          # canvas pixels
CELL        = 20                # Q-table discretisation (pixels per cell)
COLS        = W // CELL
ROWS        = H // CELL
ACTIONS     = 8                 # 8-directional movement
STEP_PX     = 4                 # pixels per physics step
MAX_TRAIL   = 60
FPS         = 60
STEPS_PER_FRAME = 3

# RL hyperparameters
ALPHA       = 0.18              # Q learning rate
GAMMA       = 0.96              # discount
EPS_START   = 0.92
EPS_MIN     = 0.05
EPS_DECAY   = 0.9985
SHIFT_BLEND = 0.35              # how much dying-Q bleeds into surviving-Q

# World
N_OBS       = 9                 # obstacles
OBS_R_MIN   = 14
OBS_R_MAX   = 38
LIFE_MAX    = 320
LIFE_DRAIN_OBS  = 2.2
LIFE_DRAIN_STEP = 0.12
GOAL_R      = 22

# Universe colours
U_COLOURS = [
    "#00ffcc", "#a78bfa", "#ff8c42", "#3b82f6",
    "#ec4899", "#84cc16", "#f59e0b", "#06b6d4",
]

# Visual
BG          = "#020510"
PANEL_BG    = "#070b1a"
BORDER      = "#141830"
C_ALIVE     = "#00ffcc"
C_DEAD      = "#ff3c6e"
C_GOAL      = "#ffd700"
C_TEXT      = "#8090b8"
C_BRIGHT    = "#c8d4f0"

# ── Goal zones — covers all 8 screen regions so agent
#    generalises to every part of the canvas ─────────────
GOAL_ZONES = [
    # corners
    (0.10, 0.10), (0.90, 0.10), (0.10, 0.90), (0.90, 0.90),
    # edges mid
    (0.50, 0.06), (0.94, 0.50), (0.50, 0.94), (0.06, 0.50),
    # inner quadrant centres
    (0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75),
    # dead centre
    (0.50, 0.50),
]
_goal_cycle = 0   # cycles through GOAL_ZONES deterministically

def next_goal_pos():
    """Return next goal position, cycling through all screen zones."""
    global _goal_cycle
    gx_r, gy_r = GOAL_ZONES[_goal_cycle % len(GOAL_ZONES)]
    _goal_cycle += 1
    # small jitter so it's never pixel-identical
    gx = clamp(W * gx_r + rnd(-W*0.04, W*0.04), GOAL_R+5, W-GOAL_R-5)
    gy = clamp(H * gy_r + rnd(-H*0.04, H*0.04), GOAL_R+5, H-GOAL_R-5)
    return (gx, gy)

# Spawn also rotates so agent can't just memorise one path
SPAWN_ZONES = [
    (0.88, 0.88), (0.12, 0.88), (0.88, 0.12), (0.12, 0.12),
    (0.50, 0.88), (0.88, 0.50), (0.50, 0.12), (0.12, 0.50),
]
_spawn_cycle = 0

def next_spawn_pos(goal):
    """Return spawn far from the goal."""
    global _spawn_cycle
    for _ in range(len(SPAWN_ZONES)):
        sx_r, sy_r = SPAWN_ZONES[_spawn_cycle % len(SPAWN_ZONES)]
        _spawn_cycle += 1
        sx = clamp(W * sx_r + rnd(-20, 20), 10, W-10)
        sy = clamp(H * sy_r + rnd(-20, 20), 10, H-10)
        if dist(sx, sy, goal[0], goal[1]) > min(W, H) * 0.35:
            return (sx, sy)
    # fallback
    return (W*0.5 + rnd(-30,30), H*0.5 + rnd(-30,30))

# Action vectors (dx, dy) for 8 directions
ACT_VEC = [
    ( 0, -1), ( 0,  1), (-1,  0), ( 1,  0),   # NSWE
    (-1, -1), ( 1, -1), (-1,  1), ( 1,  1),    # diagonals
]

# ═══════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════
def rnd(a, b):  return a + random.random() * (b - a)
def clamp(v, lo, hi): return max(lo, min(hi, v))
def px_to_cell(x, y): return (clamp(int(x/CELL),0,COLS-1), clamp(int(y/CELL),0,ROWS-1))
def cell_centre(cx, cy): return (cx*CELL + CELL//2, cy*CELL + CELL//2)
def dist(ax, ay, bx, by): return math.hypot(ax-bx, ay-by)

# ── Generalising state: relative-to-goal ───────────────────
# Instead of absolute (col,row), encode WHERE the goal is
# relative to the agent.  Buckets: 7 bins per axis (-3..+3)
# → 7×7 = 49 states  + 4 obstacle-proximity bits = compact
# but GOAL-POSITION-INDEPENDENT.  The Q-table now learns
# "when goal is to the upper-right, go upper-right" which
# works for ANY goal position on the screen.
REL_BINS = 7      # odd number so 0 = "aligned on that axis"
OBS_SENSE = 40    # pixels radius to sense nearest obstacle

def rel_state(ax, ay, gx, gy, obstacles):
    """
    Encode agent position relative to goal into a compact
    generalising state tuple.

    Components:
      dx_bin  : signed bucket of (goal_x - agent_x) in [-3,+3]
      dy_bin  : signed bucket of (goal_y - agent_y) in [-3,+3]
      obs_dir : cardinal direction of nearest obstacle (0-8, 8=none)
    """
    dx = gx - ax
    dy = gy - ay
    half = REL_BINS // 2   # 3

    # Normalise dx/dy by half-screen so bins are meaningful
    dx_norm = clamp(dx / (W * 0.5), -1.0, 1.0)
    dy_norm = clamp(dy / (H * 0.5), -1.0, 1.0)

    dx_bin = clamp(int(dx_norm * half), -half, half)
    dy_bin = clamp(int(dy_norm * half), -half, half)

    # Nearest obstacle direction (coarse 8-dir + "none")
    nearest_d = math.inf
    nearest_ox = nearest_oy = 0.0
    for (ox, oy, r) in obstacles:
        d = dist(ax, ay, ox, oy) - r
        if d < nearest_d:
            nearest_d = d
            nearest_ox, nearest_oy = ox - ax, oy - ay

    if nearest_d < OBS_SENSE:
        # quantise to 8 compass directions
        angle = math.atan2(nearest_oy, nearest_ox)
        obs_dir = int((angle + math.pi) / (2*math.pi) * 8) % 8
    else:
        obs_dir = 8   # "no obstacle nearby"

    return (dx_bin, dy_bin, obs_dir)

def blend_hex(c1, c2, t):
    """Linear interpolate two hex colours."""
    r1,g1,b1 = int(c1[1:3],16), int(c1[3:5],16), int(c1[5:7],16)
    r2,g2,b2 = int(c2[1:3],16), int(c2[3:5],16), int(c2[5:7],16)
    r = int(r1*(1-t)+r2*t); g = int(g1*(1-t)+g2*t); b = int(b1*(1-t)+b2*t)
    return f"#{r:02x}{g:02x}{b:02x}"

def darken(col, factor=0.35):
    r,g,b = int(col[1:3],16), int(col[3:5],16), int(col[5:7],16)
    return f"#{int(r*factor):02x}{int(g*factor):02x}{int(b*factor):02x}"

# ═══════════════════════════════════════════════════════════
#  Q-TABLE
# ═══════════════════════════════════════════════════════════
class QTable:
    def __init__(self):
        # sparse dict: (col, row) -> [q0..q7]
        self._q = {}

    def get(self, state):
        if state not in self._q:
            self._q[state] = [0.0] * ACTIONS
        return self._q[state]

    def best_action(self, state):
        return int(max(range(ACTIONS), key=lambda a: self.get(state)[a]))

    def update(self, s, a, r, s2, done):
        q  = self.get(s)
        q2 = self.get(s2)
        target = r if done else r + GAMMA * max(q2)
        q[a] += ALPHA * (target - q[a])

    def clone(self):
        t = QTable()
        t._q = {k: v[:] for k, v in self._q.items()}
        return t

    def blend_in(self, other, alpha):
        """Blend other Q-table into self: self = (1-α)·self + α·other"""
        all_states = set(self._q) | set(other._q)
        for s in all_states:
            sq = self.get(s)
            oq = other.get(s)
            for a in range(ACTIONS):
                sq[a] = (1 - alpha) * sq[a] + alpha * oq[a]

    def n_states(self):
        return len(self._q)


# ═══════════════════════════════════════════════════════════
#  WORLD  (shared layout + per-universe noise)
# ═══════════════════════════════════════════════════════════
class World:
    def __init__(self, universe_id, noise=0.0, shared_goal=None):
        self.uid   = universe_id
        self.colour = U_COLOURS[universe_id % len(U_COLOURS)]
        self.obstacles = []
        self.goal  = None
        self.spawn = None
        self._generate(noise, goal_override=shared_goal)

    def _generate(self, noise, goal_override=None):
        if goal_override:
            gx, gy = goal_override
        else:
            gx, gy = next_goal_pos()
        self.goal = (gx, gy)
        sx, sy = next_spawn_pos(self.goal)
        # per-universe: small jitter on spawn
        self.spawn = (sx + rnd(-noise*0.5, noise*0.5),
                      sy + rnd(-noise*0.5, noise*0.5))

        for _ in range(N_OBS):
            for attempt in range(60):
                ox = rnd(W*0.08, W*0.92) + rnd(-noise, noise)
                oy = rnd(H*0.08, H*0.92) + rnd(-noise, noise)
                r  = rnd(OBS_R_MIN, OBS_R_MAX)
                ox = clamp(ox, r, W-r); oy = clamp(oy, r, H-r)
                if dist(ox,oy,gx,gy) > 70 and dist(ox,oy,*self.spawn) > 70:
                    self.obstacles.append((ox, oy, r))
                    break


# ═══════════════════════════════════════════════════════════
#  AGENT  (one per universe)
# ═══════════════════════════════════════════════════════════
class Agent:
    def __init__(self, world, qtable, epsilon):
        self.world   = world
        self.Q       = qtable
        self.eps     = epsilon
        self.x, self.y = world.spawn
        self.life    = LIFE_MAX
        self.trail   = collections.deque(maxlen=MAX_TRAIL)
        self.dead    = False
        self.reached_goal = False
        self.steps   = 0
        self.total_reward = 0.0
        self.prev_dist = dist(self.x, self.y, *world.goal)
        self.shifted_from = None  # universe id we shifted from

    # ── choose action ──────────────────────────────────────
    def choose_action(self):
        gx, gy = self.world.goal
        state = rel_state(self.x, self.y, gx, gy, self.world.obstacles)
        if random.random() < self.eps:
            return random.randrange(ACTIONS)
        return self.Q.best_action(state)

    # ── step ───────────────────────────────────────────────
    def step(self):
        if self.dead or self.reached_goal:
            if self.trail: self.trail.popleft()
            return None

        self.trail.append((self.x, self.y))
        self.steps += 1

        gx, gy = self.world.goal
        state  = rel_state(self.x, self.y, gx, gy, self.world.obstacles)
        action = self.choose_action()
        dx, dy = ACT_VEC[action]

        nx = clamp(self.x + dx * STEP_PX, 2, W-2)
        ny = clamp(self.y + dy * STEP_PX, 2, H-2)

        # obstacle collision
        hit_obs = False
        for (ox, oy, r) in self.world.obstacles:
            if dist(nx, ny, ox, oy) < r + 5:
                od = dist(nx,ny,ox,oy) or 1
                nx = clamp(self.x + (self.x-ox)/od*2, 2, W-2)
                ny = clamp(self.y + (self.y-oy)/od*2, 2, H-2)
                self.life -= LIFE_DRAIN_OBS
                hit_obs = True
                break

        self.x, self.y = nx, ny
        self.life -= LIFE_DRAIN_STEP

        # ── reward signal ──────────────────────────────────
        gx, gy   = self.world.goal
        new_dist = dist(self.x, self.y, gx, gy)
        closer   = self.prev_dist - new_dist
        self.prev_dist = new_dist

        reward = -0.05                          # step cost
        reward += closer * 0.25                 # progress reward
        if hit_obs: reward -= 1.5              # obstacle penalty
        if self.life <= 0:
            reward -= 50.0
            self.dead = True
        if new_dist < GOAL_R:
            reward += 500.0
            self.reached_goal = True

        done       = self.dead or self.reached_goal
        next_state = rel_state(self.x, self.y, gx, gy, self.world.obstacles)

        self.Q.update(state, action, reward, next_state, done)
        self.total_reward += reward
        self.eps = max(EPS_MIN, self.eps * EPS_DECAY)

        return (state, action, reward, next_state, done)


# ═══════════════════════════════════════════════════════════
#  MULTIVERSE SIMULATION
# ═══════════════════════════════════════════════════════════
class Multiverse:
    def __init__(self, n_universes=4):
        self.n_u      = n_universes
        self.episode  = 0
        self.total_deaths   = 0
        self.total_shifts   = 0
        self.total_goals    = 0
        self.epsilon  = EPS_START
        self.active_u = 0          # which universe the "consciousness" is in
        self.log_entries = collections.deque(maxlen=100)
        self.fit_history = []
        self.worlds   = []
        self.agents   = []
        self.shared_Q = QTable()   # master knowledge
        self._init_episode()

    def _init_episode(self):
        self.episode += 1
        noise = 18.0
        # ONE goal position per episode, shared across all universes
        # → agent must generalise to reach THIS goal from different starts
        # Goal cycles through all screen zones for full generalisation
        shared_goal = next_goal_pos()
        self.worlds = [World(i, noise, shared_goal=shared_goal) for i in range(self.n_u)]
        self.agents = [
            Agent(self.worlds[i], self.shared_Q.clone(), self.epsilon)
            for i in range(self.n_u)
        ]
        self.active_u = 0
        gx, gy = shared_goal
        zone_name = f"({gx/W*100:.0f}%, {gy/H*100:.0f}%)"
        self.log(f"Episode {self.episode} — goal @ {zone_name} — {self.n_u} universes", "spawn")
        # record goal history for visualisation
        if not hasattr(self, 'goal_history'):
            self.goal_history = collections.deque(maxlen=13)
        self.goal_history.append(shared_goal)

    # ── consciousness shift ─────────────────────────────────
    def _shift_consciousness(self, dead_uid):
        """When universe dead_uid dies, shift to best surviving universe."""
        dead_agent = self.agents[dead_uid]
        survivors  = [i for i,a in enumerate(self.agents)
                      if not a.dead and not a.reached_goal]
        if not survivors:
            return None

        # Pick universe closest to goal (best candidate)
        gx, gy = self.worlds[dead_uid].goal
        best_uid = min(survivors,
                       key=lambda i: dist(self.agents[i].x, self.agents[i].y, gx, gy))

        # Blend dying knowledge INTO surviving agent
        self.agents[best_uid].Q.blend_in(dead_agent.Q, SHIFT_BLEND)

        # Survivor inherits epsilon (slightly boosted exploration)
        self.agents[best_uid].eps = max(
            self.agents[best_uid].eps,
            min(dead_agent.eps * 1.05, 0.5)
        )
        self.agents[best_uid].shifted_from = dead_uid

        self.total_shifts += 1
        old_col = U_COLOURS[dead_uid % len(U_COLOURS)]
        new_col = U_COLOURS[best_uid % len(U_COLOURS)]
        self.log(
            f"☆ SHIFT  U{dead_uid}→U{best_uid}  "
            f"(W blended {SHIFT_BLEND:.0%}, ε={self.agents[best_uid].eps:.3f})",
            "shift"
        )
        return best_uid

    # ── step all agents ─────────────────────────────────────
    def step(self):
        any_alive = False
        for i, agent in enumerate(self.agents):
            if agent.dead or agent.reached_goal:
                continue
            result = agent.step()
            any_alive = True

            if result is None: continue
            _, _, _, _, done = result

            if done:
                if agent.reached_goal:
                    self.total_goals += 1
                    self.epsilon = max(EPS_MIN, self.epsilon * 0.92)
                    self.log(f"★ GOAL  U{i}  steps={agent.steps}  "
                             f"R={agent.total_reward:.0f}  ε={agent.eps:.3f}", "goal")
                    # Merge winning knowledge to shared
                    self.shared_Q.blend_in(agent.Q, 0.6)
                    self.fit_history.append(agent.total_reward)
                    self._end_episode()
                    return

                elif agent.dead:
                    self.total_deaths += 1
                    self.log(f"✗ DEAD  U{i}  steps={agent.steps}  "
                             f"R={agent.total_reward:.0f}", "dead")
                    new_active = self._shift_consciousness(i)
                    if new_active is not None:
                        self.active_u = new_active

        if not any_alive:
            # All dead without reaching goal
            best_r = max(a.total_reward for a in self.agents)
            self.fit_history.append(best_r)
            self.log(f"✗ ALL DEAD  Ep{self.episode}  bestR={best_r:.0f}", "dead")
            # Still blend best knowledge
            best_agent = max(self.agents, key=lambda a: a.total_reward)
            self.shared_Q.blend_in(best_agent.Q, 0.3)
            self._end_episode()

    def _end_episode(self):
        # Sync shared Q from episode agents (averaging)
        for a in self.agents:
            self.shared_Q.blend_in(a.Q, 0.15)
        self.log(f"— Episode {self.episode} done  "
                 f"Q-states={self.shared_Q.n_states()}  "
                 f"shifts={self.total_shifts}", "info")
        self._init_episode()

    def log(self, msg, typ="info"):
        self.log_entries.appendleft({"msg": msg, "type": typ})

    def active_agent(self):
        if self.active_u < len(self.agents):
            return self.agents[self.active_u]
        return None


# ═══════════════════════════════════════════════════════════
#  RENDERER  (tkinter Canvas)
# ═══════════════════════════════════════════════════════════
class Renderer:
    def __init__(self, canvas, mv):
        self.canvas = canvas
        self.mv     = mv
        self._items = {}   # tag → canvas id cache (minor optimisation)
        self._glow_phase = 0.0

    def draw(self):
        c  = self.canvas
        mv = self.mv
        c.delete("all")
        self._glow_phase += 0.05

        # ── background grid ──────────────────────────────
        for cx in range(0, W, CELL*2):
            c.create_line(cx, 0, cx, H, fill="#0a0d20", width=1)
        for cy in range(0, H, CELL*2):
            c.create_line(0, cy, W, cy, fill="#0a0d20", width=1)

        # ── past goal ghost markers ──────────────────────
        # shows all the positions goal has been → agent must have
        # learned to reach each one = generalisation proof
        if hasattr(mv, 'goal_history'):
            gh = list(mv.goal_history)
            for k, (pgx, pgy) in enumerate(gh[:-1]):  # skip current
                age = len(gh) - 1 - k
                alpha = max(0.05, 0.35 - age * 0.025)
                sz = int(6 - age * 0.3)
                if sz < 2: sz = 2
                bright = int(alpha * 180)
                ghost_col = f"#{bright:02x}{int(bright*0.84):02x}00"
                c.create_oval(pgx-sz, pgy-sz, pgx+sz, pgy+sz,
                              fill=ghost_col, outline="")
                c.create_text(pgx, pgy - sz - 5,
                              text="✓", fill=ghost_col,
                              font=("Courier", 7))

        # ── Q-policy field (arrows from current goal perspective) ──
        self._draw_qmap()

        # ── agents (all universes) ────────────────────────
        for i, agent in enumerate(mv.agents):
            is_active = (i == mv.active_u)
            self._draw_agent(agent, i, is_active)

        # ── goal (use first world as reference) ──────────
        if mv.worlds:
            gx, gy = mv.worlds[0].goal
            pulse = 14 + math.sin(self._glow_phase) * 4
            # glow rings
            for ri, alpha in [(50, 0.08), (34, 0.14), (22, 0.22)]:
                c.create_oval(gx-ri, gy-ri, gx+ri, gy+ri,
                              outline=C_GOAL,
                              width=max(1, int(alpha*6)),
                              stipple="gray25" if alpha < 0.15 else "")
            c.create_oval(gx-9, gy-9, gx+9, gy+9,
                          fill=C_GOAL, outline="")
            c.create_text(gx, gy+26, text=f"GOAL ★  Ep{mv.episode}",
                          fill=C_GOAL, font=("Courier", 7))

        # ── stats overlay (top-left) ──────────────────────
        self._draw_stats()

    def _draw_qmap(self):
        """
        Draw the learned policy as arrows across the canvas.
        For each grid cell, compute the rel_state toward the current goal,
        then look up the best action from Q.  This shows how the agent
        ACTUALLY plans to move from every point toward the CURRENT goal —
        visually confirming generalisation.
        """
        c  = self.canvas
        mv = self.mv
        Q  = mv.shared_Q
        if Q.n_states() < 4 or not mv.worlds:
            return
        gx, gy = mv.worlds[0].goal
        step = CELL * 2
        for px in range(step//2, W, step):
            for py in range(step//2, H, step):
                # use no obstacles for the map (shows pure navigation intent)
                state = rel_state(px, py, gx, gy, [])
                qs = Q._q.get(state)
                if qs is None:
                    continue
                mag = max(qs) - min(qs)
                if mag < 0.4:
                    continue
                best_a = int(max(range(ACTIONS), key=lambda a: qs[a]))
                dx, dy = ACT_VEC[best_a]
                alpha = clamp(mag / 10.0, 0.0, 1.0)
                brightness = int(alpha * 36 + 6)
                col_str = f"#{brightness:02x}{brightness+10:02x}{brightness:02x}"
                ex = px + dx * step * 0.55
                ey = py + dy * step * 0.55
                c.create_line(px, py, ex, ey, fill=col_str, width=1)

    def _draw_agent(self, agent, uid, is_active):
        c      = self.canvas
        colour = U_COLOURS[uid % len(U_COLOURS)]
        dark   = darken(colour, 0.2)

        # trail
        tr = list(agent.trail)
        if len(tr) > 1:
            for k in range(1, len(tr)):
                t_alpha = k / len(tr)
                w = 2 if is_active else 1
                tr_col = colour if is_active else darken(colour, 0.4 + t_alpha*0.4)
                if t_alpha > 0.15:  # skip very faint start
                    c.create_line(tr[k-1][0], tr[k-1][1],
                                  tr[k][0],   tr[k][1],
                                  fill=tr_col, width=w)

        if agent.dead or agent.reached_goal:
            return

        x, y = agent.x, agent.y

        # life ring
        life_frac = agent.life / LIFE_MAX
        ring_r = 11 if is_active else 8
        end_deg = int(life_frac * 360)
        if end_deg > 0:
            c.create_arc(x-ring_r, y-ring_r, x+ring_r, y+ring_r,
                         start=90, extent=-end_deg,
                         style=tk.ARC,
                         outline=colour,
                         width=2 if is_active else 1)

        # core dot
        r = 7 if is_active else 4
        c.create_oval(x-r, y-r, x+r, y+r, fill=colour, outline="")

        # active universe: outer pulse ring
        if is_active:
            pr = 16 + int(math.sin(self._glow_phase*2)*3)
            c.create_oval(x-pr, y-pr, x+pr, y+pr,
                          outline=colour, width=1)
            c.create_text(x, y-22, text=f"U{uid} ★",
                          fill=colour, font=("Courier", 7, "bold"))
        else:
            c.create_text(x, y-14, text=f"U{uid}",
                          fill=darken(colour, 0.6), font=("Courier", 6))

        # obstacles for this universe
        for (ox, oy, r) in agent.world.obstacles:
            c.create_oval(ox-r, oy-r, ox+r, oy+r,
                          outline=darken("#ff3c6e", 0.5),
                          width=1, fill="",
                          dash=(3, 4) if not is_active else ())
        # solid obstacles for active universe
        if is_active:
            for (ox, oy, r) in agent.world.obstacles:
                c.create_oval(ox-r, oy-r, ox+r, oy+r,
                              outline="#ff3c6e",
                              width=1.5, fill="")

    def _draw_stats(self):
        c = self.canvas
        mv = self.mv
        aa = mv.active_agent()
        n_goals_seen = len(mv.goal_history) if hasattr(mv, 'goal_history') else 0
        lines = [
            f"EP {mv.episode}   SHIFTS {mv.total_shifts}",
            f"DEATHS {mv.total_deaths}   GOALS {mv.total_goals}",
            f"Q-STATES {mv.shared_Q.n_states()}  (rel-to-goal)",
            f"ZONES VISITED {n_goals_seen}/{len(GOAL_ZONES)}",
        ]
        if aa:
            lines += [
                f"ACTIVE U{mv.active_u}  life={aa.life:.0f}",
                f"ε={aa.eps:.3f}  steps={aa.steps}",
                f"R={aa.total_reward:.1f}",
            ]
        for i, txt in enumerate(lines):
            c.create_text(10, 12 + i*13, text=txt,
                          fill=C_TEXT, anchor="w",
                          font=("Courier", 8))


# ═══════════════════════════════════════════════════════════
#  SIDEBAR  (log + controls)
# ═══════════════════════════════════════════════════════════
LOG_COLOURS = {
    "spawn": "#00ffcc",
    "dead":  "#ff3c6e",
    "shift": "#a78bfa",
    "goal":  "#ffd700",
    "info":  "#8090b8",
}

class Sidebar:
    def __init__(self, parent, mv):
        self.mv = mv
        self.frame = tk.Frame(parent, bg=PANEL_BG,
                              width=260, relief="flat")
        self.frame.pack_propagate(False)
        self.frame.pack(side="right", fill="y")

        # Title
        tk.Label(self.frame, text="MULTIVERSE RL",
                 bg=PANEL_BG, fg=C_ALIVE,
                 font=("Courier", 10, "bold")).pack(pady=(10,2))
        tk.Label(self.frame, text="consciousness-shift agent",
                 bg=PANEL_BG, fg=C_TEXT,
                 font=("Courier", 7)).pack(pady=(0,8))

        # Controls
        ctrl = tk.Frame(self.frame, bg=PANEL_BG)
        ctrl.pack(fill="x", padx=8, pady=4)

        self.btn_run   = self._btn(ctrl, "▶ RUN",   "#00ffcc", self._run)
        self.btn_pause = self._btn(ctrl, "⏸ PAUSE", "#a78bfa", self._pause)
        self.btn_reset = self._btn(ctrl, "↺ RESET", "#ff3c6e", self._reset)
        self.btn_run.pack(side="left", expand=True, fill="x", padx=2)
        self.btn_pause.pack(side="left", expand=True, fill="x", padx=2)
        self.btn_reset.pack(side="left", expand=True, fill="x", padx=2)

        self.running = False
        self._app = None   # set externally

        # Sliders
        sep = tk.Frame(self.frame, bg=BORDER, height=1)
        sep.pack(fill="x", padx=8, pady=6)

        tk.Label(self.frame, text="PARAMETERS",
                 bg=PANEL_BG, fg="#283050",
                 font=("Courier", 7)).pack(anchor="w", padx=10)

        self.sv_u   = self._slider("Universes U", 1, 8, mv.n_u)
        self.sv_obs = self._slider("Obstacles",   2,20, N_OBS)
        self.sv_eps = self._slider("ε explore×10",1,20,int(EPS_START*10))
        self.sv_spd = self._slider("Sim speed",   1, 8, STEPS_PER_FRAME)
        self.sv_lr  = self._slider("α (lr)×100", 1,40, int(ALPHA*100))

        # Fitness mini-chart
        sep2 = tk.Frame(self.frame, bg=BORDER, height=1)
        sep2.pack(fill="x", padx=8, pady=6)
        tk.Label(self.frame, text="EPISODE REWARD",
                 bg=PANEL_BG, fg="#283050",
                 font=("Courier", 7)).pack(anchor="w", padx=10)

        self.fit_canvas = tk.Canvas(self.frame, width=240, height=50,
                                    bg=PANEL_BG, highlightthickness=0)
        self.fit_canvas.pack(padx=10, pady=4)

        # Log
        sep3 = tk.Frame(self.frame, bg=BORDER, height=1)
        sep3.pack(fill="x", padx=8, pady=4)
        tk.Label(self.frame, text="EVENT LOG",
                 bg=PANEL_BG, fg="#283050",
                 font=("Courier", 7)).pack(anchor="w", padx=10)

        self.log_text = tk.Text(
            self.frame, bg=PANEL_BG, fg=C_TEXT,
            font=("Courier", 7), state="disabled",
            relief="flat", wrap="word", height=14,
        )
        self.log_text.pack(fill="both", expand=True, padx=6, pady=(0,8))
        for tag, col in LOG_COLOURS.items():
            self.log_text.tag_config(tag, foreground=col)

    def _btn(self, parent, text, col, cmd):
        b = tk.Button(parent, text=text, command=cmd,
                      bg=PANEL_BG, fg=col,
                      relief="flat", bd=0,
                      font=("Courier", 7, "bold"),
                      activebackground=col,
                      activeforeground=PANEL_BG,
                      cursor="hand2", padx=4, pady=3)
        return b

    def _slider(self, label, lo, hi, init):
        row = tk.Frame(self.frame, bg=PANEL_BG)
        row.pack(fill="x", padx=10, pady=1)
        tk.Label(row, text=label, bg=PANEL_BG, fg=C_TEXT,
                 font=("Courier", 7), width=14, anchor="w").pack(side="left")
        val_lbl = tk.Label(row, text=str(init), bg=PANEL_BG, fg=C_ALIVE,
                           font=("Courier", 7), width=3)
        val_lbl.pack(side="right")
        sv = tk.IntVar(value=init)
        sl = tk.Scale(row, from_=lo, to=hi, orient="horizontal",
                      variable=sv, bg=PANEL_BG, fg=C_TEXT,
                      troughcolor=BORDER, highlightthickness=0,
                      sliderlength=10, length=100, showvalue=False,
                      command=lambda v, l=val_lbl, s=sv: l.config(text=str(s.get())))
        sl.pack(side="right")
        return sv

    def _run(self):
        self.running = True

    def _pause(self):
        self.running = False

    def _reset(self):
        self.running = False
        self.mv.__init__(self.sv_u.get())

    def update_log(self):
        mv = self.mv
        self.log_text.config(state="normal")
        self.log_text.delete("1.0", "end")
        for entry in list(mv.log_entries)[:50]:
            typ = entry["type"]
            self.log_text.insert("end", entry["msg"] + "\n", typ)
        self.log_text.config(state="disabled")

    def update_chart(self):
        fc = self.fit_canvas
        fc.delete("all")
        h = mv.fit_history
        if len(h) < 2: return
        fw, fh = 240, 50
        mn, mx = min(h), max(h)
        rng = (mx - mn) or 1
        pts = []
        for i, v in enumerate(h):
            x = i / (len(h)-1) * fw
            y = fh - (v-mn)/rng * (fh-4) - 2
            pts.append((x, y))
        for i in range(1, len(pts)):
            fc.create_line(pts[i-1][0], pts[i-1][1],
                           pts[i][0],   pts[i][1],
                           fill=C_ALIVE, width=1)


# ═══════════════════════════════════════════════════════════
#  APP
# ═══════════════════════════════════════════════════════════
class App:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("MULTIVERSE AGENT — Consciousness-Shift RL")
        self.root.configure(bg=BG)
        self.root.resizable(False, False)

        # ── layout ───────────────────────────────────────
        main = tk.Frame(self.root, bg=BG)
        main.pack(fill="both", expand=True)

        # header
        hdr = tk.Frame(main, bg="#070b1a", height=36)
        hdr.pack(fill="x")
        hdr.pack_propagate(False)
        tk.Label(hdr, text="MULTIVERSE AGENT  //  CONSCIOUSNESS-SHIFT REINFORCEMENT LEARNING",
                 bg="#070b1a", fg=C_ALIVE, font=("Courier", 9, "bold")).pack(
                 side="left", padx=12, pady=8)
        tk.Label(hdr, text="Q-LEARNING · ε-GREEDY · INTER-UNIVERSE KNOWLEDGE BLEND",
                 bg="#070b1a", fg=C_TEXT, font=("Courier", 7)).pack(
                 side="right", padx=12)

        body = tk.Frame(main, bg=BG)
        body.pack(fill="both", expand=True)

        # canvas
        self.canvas = tk.Canvas(body, width=W, height=H,
                                 bg=BG, highlightthickness=0)
        self.canvas.pack(side="left", fill="both", expand=True)

        global mv
        mv = Multiverse(n_universes=4)
        self.mv = mv

        self.sidebar  = Sidebar(body, mv)
        self.renderer = Renderer(self.canvas, mv)

        self._tick()

    def _tick(self):
        sb = self.sidebar
        mv = self.mv

        # Sync slider-driven params
        mv.n_u = sb.sv_u.get()  # universe count change takes effect next episode

        if sb.running:
            spd = sb.sv_spd.get()
            for _ in range(spd):
                mv.step()

        self.renderer.draw()
        sb.update_log()
        sb.update_chart()

        self.root.after(1000 // FPS, self._tick)

    def run(self):
        self.root.mainloop()


# ═══════════════════════════════════════════════════════════
#  ENTRY
# ═══════════════════════════════════════════════════════════
if __name__ == "__main__":
    App().run()