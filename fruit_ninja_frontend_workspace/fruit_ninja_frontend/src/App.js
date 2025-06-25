import React, { useEffect, useRef, useState } from "react";
import "./App.css";

/**
 * Fruit Ninja React App
 * All game logic is included here, using a playful, accessible, and modern React SPA architecture.
 */
/*
  Colors for theme:
  --accent: #F44336;
  --primary: #4CAF50;
  --secondary: #FFC107;
  Theme: light, modern, playful.
*/

// --- Utility Functions ---
const FRUITS = [
  {
    name: "🍎",
    color: "#F44336",
    radius: 36,
    points: 1,
    type: "apple"
  },
  {
    name: "🍉",
    color: "#4CAF50",
    radius: 38,
    points: 1,
    type: "watermelon"
  },
  {
    name: "🍋",
    color: "#FFC107",
    radius: 34,
    points: 1,
    type: "lemon"
  },
  {
    name: "🥝",
    color: "#009688",
    radius: 34,
    points: 1,
    type: "kiwi"
  },
  {
    name: "🍊",
    color: "#FF9800",
    radius: 32,
    points: 1,
    type: "orange"
  },
  {
    name: "🍌",
    color: "#FFD600",
    radius: 30,
    points: 1,
    type: "banana"
  },
  // Golden fruit
  {
    name: "🥇",
    color: "#ffe066",
    radius: 38,
    points: 10,
    type: "golden",
    bonus: "golden"
  },
  // Star fruit
  {
    name: "⭐",
    color: "#ffec40",
    radius: 34,
    points: 5,
    type: "star",
    bonus: "star"
  }
];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

// Fruit spawn logic (handle probability for golden/star fruit)
function createFruit(boardWidth, boardHeight) {
  // 3% chance golden, 5% star, else normal fruit
  let fruitType;
  const rng = Math.random();
  if (rng < 0.03) {
    fruitType = FRUITS.find(f => f.bonus === "golden");
  } else if (rng < 0.08) {
    fruitType = FRUITS.find(f => f.bonus === "star");
  } else {
    // only regular fruits
    fruitType = FRUITS[Math.floor(randomBetween(0, 6))];
  }
  const x = randomBetween(
    fruitType.radius + 40,
    boardWidth - fruitType.radius - 40
  );
  return {
    id: `fruit_${Date.now()}_${Math.random()}`,
    ...fruitType,
    x,
    y: boardHeight + fruitType.radius,
    velocityX: randomBetween(-2, 2),
    velocityY: randomBetween(-22, -16),
    gravity: 0.35 + Math.random() * 0.05,
    sliced: false,
    sliceLine: null,
    angry: false,
  };
}

// Simple collision for slicing
function isFruitSliced(fruit, x1, y1, x2, y2) {
  // Closest point on line segment (x1,y1)-(x2,y2) to (fx,fy)
  const { x: fx, y: fy, radius } = fruit;
  const dx = x2 - x1,
    dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return false;
  let t = ((fx - x1) * dx + (fy - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx,
    py = y1 + t * dy;
  const dist2 = (fx - px) ** 2 + (fy - py) ** 2;
  return dist2 <= (radius * radius) * 0.85; // a bit forgiving
}

// --- React Components ---

function App() {
  // --- GAME MODE SUPPORT ---
  // mode: "classic" (default, lives) or "timer" (timed play)
  const [gameMode, setGameMode] = useState("classic");
  // Game state
  const [gameState, setGameState] = useState("start"); // start | running | paused | gameover
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(
    () => parseInt(localStorage.getItem("fruitninja_best") || "0", 10)
  );
  const [fruits, setFruits] = useState([]);
  const [missed, setMissed] = useState(0);
  const [sliceTrails, setSliceTrails] = useState([]);
  const [dimensions, setDimensions] = useState({ w: 480, h: 640 });
  const boardRef = useRef(null);
  const animFrameRef = useRef(null);
  const timeSinceLastFruit = useRef(0);
  const runningRef = useRef(false);

  // Combo mechanic
  const [lastSlicedTime, setLastSlicedTime] = useState(0);
  const [comboCount, setComboCount] = useState(0);

  // Bonus display (text, xy, type, ts)
  const [bonuses, setBonuses] = useState([]); // {msg, x, y, ts, color}

  // For slicing gestures
  const [gesture, setGesture] = useState({
    slicing: false,
    points: [],
  });

  // --- TIMER STATE (only used in timer mode) ---
  const TIMER_LENGTH = 60; // seconds (can adjust)
  const [timer, setTimer] = useState(TIMER_LENGTH); // seconds left
  const timerRef = useRef(null);

  // Responsive sizing
  useEffect(() => {
    function handleResize() {
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      let w = Math.min(520, ww - 16);
      let h = Math.max(400, Math.min(ww * 1.4, wh - 160));
      setDimensions({ w, h });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle best score (shared for both modes)
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem("fruitninja_best", score.toString());
    }
  }, [score, bestScore]);

  // Game timer (timer mode only)
  useEffect(() => {
    if (
      gameState === "running" &&
      gameMode === "timer" &&
      timer > 0
    ) {
      timerRef.current = setTimeout(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    if (
      gameState === "running" &&
      gameMode === "timer" &&
      timer === 0
    ) {
      setTimeout(() => setGameState("gameover"), 550); // Small pause for last slice effect
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line
  }, [gameState, timer, gameMode]);

  // Main game loop (animation)
  useEffect(() => {
    if (gameState !== "running") {
      runningRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }
    runningRef.current = true;
    let prevTimestamp = performance.now();

    function gameLoop(t) {
      // animation tick
      const dt = (t - prevTimestamp) / 16.66; // convert to ~frames
      prevTimestamp = t;
      // Move fruits and check for out of bounds
      setFruits((oldFruits) => {
        let newFruits = [];
        let newMissed = 0;
        oldFruits.forEach((fruit) => {
          if (fruit.sliced) {
            // Gravity after sliced: add spinning/falling
            let dy = fruit.velocityY + fruit.gravity * dt * 0.66;
            let angle = (fruit.sliceAngle || 0) + 0.13 * dt;
            let ny = fruit.y + dy * dt;
            let nx = fruit.x + fruit.velocityX * dt;
            if (ny < dimensions.h + 65) {
              newFruits.push({
                ...fruit,
                y: ny,
                x: nx,
                velocityY: dy,
                sliceAngle: angle,
              });
            }
          } else {
            let vy = fruit.velocityY + fruit.gravity * dt;
            let ny = fruit.y + vy * dt;
            let nx = fruit.x + fruit.velocityX * dt;
            if (ny < dimensions.h + fruit.radius + 34) {
              newFruits.push({
                ...fruit,
                y: ny,
                x: nx,
                velocityY: vy,
              });
            } else {
              // Missed fruit logic
              if (gameMode === "classic") {
                newMissed++;
              }
              // In timer mode, do nothing for missed (no penalty)
            }
          }
        });
        if (gameMode === "classic" && newMissed > 0) {
          setMissed((lastMissed) => lastMissed + newMissed);
          if (missed + newMissed >= 3) setGameState("gameover");
        }
        return newFruits;
      });

      // Add fruits at random intervals
      timeSinceLastFruit.current += 1;
      if (
        timeSinceLastFruit.current >
        randomBetween(
          28 - Math.min(score, 22),
          45 - Math.min(score, 33) // Increase speed as score grows
        )
      ) {
        const numberToSpawn =
          Math.random() < 0.13 ? 2 : Math.random() < 0.37 ? 1 : 0;

        let arr = [];
        for (let i = 0; i < numberToSpawn; ++i)
          arr.push(createFruit(dimensions.w, dimensions.h));
        setFruits((prev) => [...prev, ...arr]);
        timeSinceLastFruit.current = 0;
      }

      // Remove old trails
      setSliceTrails((old) =>
        old.length > 12 ? old.slice(-12) : old.filter((t) => t.t > t - 350)
      );
      // Remove old bonuses (after 1.2s)
      setBonuses((old) => old.filter((b) => t - (b.ts || 0) < 1200));
      if (runningRef.current)
        animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => animFrameRef.current && cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line
  }, [gameState, dimensions, score, missed, gameMode]);


  // --- Gesture and Slicing Handlers ---

  // Convert pageX/Y to board-relative coords
  function getRelativeCoords(evt) {
    let rect = boardRef.current.getBoundingClientRect();
    let touch = evt.touches ? evt.touches[0] : evt;
    return {
      x: ((touch.clientX - rect.left) / rect.width) * dimensions.w,
      y: ((touch.clientY - rect.top) / rect.height) * dimensions.h,
    };
  }

  // PUBLIC_INTERFACE
  function startSlicing(evt) {
    if (gameState !== "running") return;
    evt.preventDefault();
    setGesture({ slicing: true, points: [getRelativeCoords(evt)] });
  }
  // PUBLIC_INTERFACE
  function moveSlicing(evt) {
    if (!gesture.slicing || gameState !== "running") return;
    evt.preventDefault();
    setGesture((prev) => ({
      slicing: true,
      points: [...prev.points, getRelativeCoords(evt)],
    }));
    // Generate slice trail for visual
    const p = getRelativeCoords(evt);
    setSliceTrails((old) => [
      ...old,
      { ...p, t: Date.now() },
    ]);
    // Check slicing fruits
    if (gesture.points.length < 1) return;
    const { x: x1, y: y1 } = gesture.points[gesture.points.length - 1];
    const { x: x2, y: y2 } = p;

    // Combo & Bonus logic
    setFruits((oldFruits) => {
      let newSlices = [];
      let now = Date.now();
      const updated = oldFruits.map((fruit) => {
        if (!fruit.sliced && isFruitSliced(fruit, x1, y1, x2, y2)) {
          newSlices.push({fruit, x: fruit.x, y: fruit.y});
          return {
            ...fruit,
            sliced: true,
            sliceLine: { x1, y1, x2, y2 },
            sliceAngle: Math.atan2(y2 - y1, x2 - x1),
          };
        }
        return { ...fruit };
      });

      // Combo: if slicing multiple in <0.35s, or >=2 at once = combo
      // Show bonus for slicing golden/star, or for combo
      if (newSlices.length > 0) {
        // Count combo (for quick consecutive slices)
        if (now - lastSlicedTime < 350) {
          setComboCount((c) => c + newSlices.length);
        } else {
          setComboCount(newSlices.length);
        }
        setLastSlicedTime(now);

        // Points calculation and bonus visuals
        let gainedScore = 0;
        let newBonuses = [];
        let slicedBonus = false;
        newSlices.forEach(({fruit, x, y}) => {
          // bonus fruit?
          if (fruit.bonus === "golden") {
            gainedScore += fruit.points;
            slicedBonus = true;
            newBonuses.push({
              msg: "+10 GOLDEN!",
              color: "#ffd700",
              x, y,
              ts: now
            });
          } else if (fruit.bonus === "star") {
            gainedScore += fruit.points;
            slicedBonus = true;
            newBonuses.push({
              msg: "+5 STAR!",
              color: "#ffe066",
              x, y,
              ts: now
            });
          } else {
            gainedScore += (fruit.points || 1);
          }
        });
        // Combo bonus (2 or more in one swipe or chain of quick slices)
        if (comboCount + newSlices.length >= 2) {
          const bonus = (comboCount + newSlices.length) * 2; // 2 pts per combo fruit
          gainedScore += bonus;
          // Show bonus message above center of slice segment
          let sumX = 0, sumY = 0;
          newSlices.forEach(({x, y}) => { sumX += x; sumY += y; });
          newBonuses.push({
            msg: `Combo +${bonus}!`,
            color: "#43A047",
            x: sumX / newSlices.length,
            y: sumY / newSlices.length - 24,
            ts: now
          });
        }
        setBonuses((prev) => [...prev, ...newBonuses]);
        setScore((cur) => cur + gainedScore);
      }
      return updated;
    });
  }

  // PUBLIC_INTERFACE
  function endSlicing(evt) {
    if (gameState !== "running") return;
    evt && evt.preventDefault();
    setGesture({ slicing: false, points: [] });
  }

  // Reset Game
  // PUBLIC_INTERFACE
  function startGame(selectedMode = gameMode) {
    setScore(0);
    setMissed(0);
    setFruits([]);
    setSliceTrails([]);
    timeSinceLastFruit.current = 0;
    setComboCount(0);
    setLastSlicedTime(0);
    setBonuses([]);
    setGesture({ slicing: false, points: [] });
    if (selectedMode === "timer") {
      setTimer(TIMER_LENGTH);
      setGameMode("timer");
    } else {
      setGameMode("classic");
      setTimer(TIMER_LENGTH);
    }
    setGameState("running");
  }

  // PUBLIC_INTERFACE
  function pauseGame() {
    setGameState("paused");
  }

  // PUBLIC_INTERFACE
  function resumeGame() {
    setGameState("running");
  }

  // PUBLIC_INTERFACE
  function toStartScreen() {
    setGameState("start");
    setScore(0);
    setMissed(0);
    setFruits([]);
    setSliceTrails([]);
    setTimer(TIMER_LENGTH);
  }

  // Theme settings: Always light, but allow a playful switch
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // --- Render Functions ---

  // Render fruits on SVG
  function renderFruits() {
    return fruits.map((fruit) => {
      // Not sliced: normal fruit (override golden/star style with light border)
      if (!fruit.sliced) {
        let isBonus = fruit.bonus === "golden" || fruit.bonus === "star";
        let border = isBonus ? "#ffeb3b" : "#fff";
        let shadow = isBonus
          ? "drop-shadow(0 2px 11px #ffe06688)"
          : "drop-shadow(0 2px 7px rgba(0,0,0,0.16))";
        return (
          <g
            key={fruit.id}
            style={{
              pointerEvents: "none",
              filter: shadow
            }}
          >
            <circle
              cx={fruit.x}
              cy={fruit.y}
              r={fruit.radius}
              fill={fruit.color}
              opacity={isBonus ? 1 : 0.88}
              stroke={border}
              strokeWidth={isBonus ? 4 : 0}
            />
            <text
              x={fruit.x}
              y={fruit.y + 10}
              textAnchor="middle"
              fontSize={fruit.radius * 1.25}
              fontWeight="bold"
              style={{
                userSelect: "none",
                pointerEvents: "none",
                dominantBaseline: "middle",
                filter: isBonus ? "drop-shadow(0 0 9px #fff)" : undefined
              }}
            >
              {fruit.name}
            </text>
          </g>
        );
      } else {
        // Sliced: show split + simple effect (bonus glimmer)
        const dx = Math.cos(fruit.sliceAngle || 0) * fruit.radius * 0.7;
        const dy = Math.sin(fruit.sliceAngle || 0) * fruit.radius * 0.7;
        const extraGlow = fruit.bonus
          ? (
            <circle
              cx={fruit.x}
              cy={fruit.y}
              r={fruit.radius * 0.92}
              fill={fruit.bonus === "golden" ? "#ffe066" : "#ffec40"}
              opacity={0.23}
            />
          ) : null;
        return (
          <g
            key={fruit.id + "_sliced"}
            filter="drop-shadow(0 3px 8px rgba(80,0,0,0.14))"
          >
            {/* Glimmer */}
            {extraGlow}
            {/* Left half */}
            <g
              style={{
                transform: `translate(${fruit.x}px,${fruit.y}px) rotate(${
                  ((fruit.sliceAngle || 0) * 180) / Math.PI - 16
                }deg) translate(${-dx}px,${-dy}px) scale(1,1)`,
              }}
            >
              <path
                d={describeArcPath(0, 0, fruit.radius, 135, 315)}
                fill={fruit.color}
                opacity={0.88}
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                x={0}
                y={10}
                fontSize={fruit.radius * 1.15}
                textAnchor="middle"
                style={{
                  userSelect: "none",
                  dominantBaseline: "middle",
                  pointerEvents: "none",
                }}
              >
                {fruit.name}
              </text>
            </g>
            {/* Right half */}
            <g
              style={{
                transform: `translate(${fruit.x}px,${fruit.y}px) rotate(${
                  ((fruit.sliceAngle || 0) * 180) / Math.PI + 16
                }deg) translate(${dx}px,${dy}px) scale(-1,1)`,
              }}
            >
              <path
                d={describeArcPath(0, 0, fruit.radius, 225, 45)}
                fill={fruit.color}
                opacity={0.88}
                stroke="#fff"
                strokeWidth="2"
              />
              <text
                x={0}
                y={10}
                fontSize={fruit.radius * 1.15}
                textAnchor="middle"
                style={{
                  userSelect: "none",
                  dominantBaseline: "middle",
                  pointerEvents: "none",
                }}
              >
                {fruit.name}
              </text>
            </g>
            {/* Juice splash */}
            <circle
              cx={fruit.x}
              cy={fruit.y}
              r={fruit.radius * 0.49}
              fill="#fff"
              opacity={0.18}
            />
          </g>
        );
      }
    });
  }

  // Helper to describe SVG arc path for fruit halves
  function describeArcPath(cx, cy, r, startAngle, endAngle) {
    const rad = (a) => ((a - 90) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(rad(startAngle));
    const y1 = cy + r * Math.sin(rad(startAngle));
    const x2 = cx + r * Math.cos(rad(endAngle));
    const y2 = cy + r * Math.sin(rad(endAngle));
    const arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", cx, cy,
      "L", x1, y1,
      "A", r, r, 0, arcSweep, 1, x2, y2,
      "L", cx, cy,
      "Z"
    ].join(" ");
  }

  // Render active bonus effects (floating/fading text in SVG)
  function renderBonusEffects() {
    if (!bonuses.length) return null;
    return (
      <g>
        {bonuses.map(({msg, x, y, ts, color}, i) => {
          let t = Math.min((Date.now() - ts) / 1050, 1.12);
          let opacity = 1 - t;
          let dy = y - 60 * t + Math.random() * 8 * (1 - opacity);
          let fontSz = 21 + 19 * (1 - t);
          let textShadow = color === "#ffd700" || color === "#ffe066"
            ? "0 0 19px #ffe066cc,0 1px 12px #fff"
            : "0 2px 11px #fff";
          return (
            <text
              key={msg+ts+i}
              x={x}
              y={dy}
              fontSize={fontSz}
              fill={color}
              opacity={opacity}
              stroke="#fff"
              strokeWidth={1.1}
              textAnchor="middle"
              style={{
                fontWeight: 700,
                letterSpacing: ".5px",
                filter: "drop-shadow(0 2px 9px #fff)",
                textShadow
              }}
              pointerEvents="none"
            >
              {msg}
            </text>
          );
        })}
      </g>
    );
  }

  // Render slice trails
  function renderSliceTrails() {
    if (sliceTrails.length < 2) return null;
    let trails = [];
    for (let i = 1; i < sliceTrails.length; ++i) {
      let prev = sliceTrails[i - 1], curr = sliceTrails[i];
      let fade = Math.max(0.12, 0.6 - (sliceTrails.length - i) * 0.06);
      trails.push(
        <line
          key={i}
          x1={prev.x}
          y1={prev.y}
          x2={curr.x}
          y2={curr.y}
          stroke="#fff"
          strokeWidth={12 - Math.sqrt(sliceTrails.length - i) * 3}
          opacity={fade}
          strokeLinecap="round"
        />
      );
      trails.push(
        <line
          key={i + 99}
          x1={prev.x}
          y1={prev.y}
          x2={curr.x}
          y2={curr.y}
          stroke="#F44336"
          strokeWidth={5 - Math.sqrt(sliceTrails.length - i) * 1.2}
          opacity={fade * 0.93}
          strokeLinecap="round"
        />
      );
    }
    return <g>{trails}</g>;
  }

  // Panels: Start, Pause, GameOver
  function renderOverlay() {
    if (gameState === "start") {
      return (
        <div className="game-overlay start">
          <h1>
            <span style={{ color: "#4CAF50" }}>Fruit</span>
            {" "}
            <span style={{ color: "#F44336" }}>Ninja</span>
            <span className="emojiBrand" role="img" aria-label="sword">
              {" "}
              🗡️
            </span>
          </h1>
          <p className="subtitle">
            {gameMode === "classic"
              ? <>Swipe to slice!<br />Score points. Miss 3 fruits and it's GAME OVER.</>
              : <>Timer Mode: Slice as many fruits as you can in <b>{TIMER_LENGTH}</b> seconds!<br />
                No penalty for missed fruits.</>
            }
          </p>
          {/* Mode selection controls */}
          <div style={{ marginBottom: 18 }}>
            <button
              onClick={() => setGameMode("classic")}
              className={`btn ${gameMode === "classic" ? "primary" : ""}`}
              style={{ minWidth: 120, marginRight: 4 }}
              aria-pressed={gameMode === "classic"}
            >
              Classic
            </button>
            <button
              onClick={() => setGameMode("timer")}
              className={`btn ${gameMode === "timer" ? "primary" : ""}`}
              style={{ minWidth: 120, marginLeft: 4 }}
              aria-pressed={gameMode === "timer"}
            >
              Timer
            </button>
          </div>
          <button
            onClick={() => startGame(gameMode)}
            className="btn primary large"
            style={{ minWidth: 158, marginTop: 2 }}
          >
            Start Game
          </button>
          {gameMode === "timer" && (
            <div style={{
              marginTop: 18, color: "#4CAF50", fontWeight: 400, fontSize: "1em"
            }}>
              <TimerBar timer={TIMER_LENGTH} total={TIMER_LENGTH} />
              <div style={{ fontSize: "0.96em", color: "#888", marginTop: 2 }}>Try for a high score!</div>
            </div>
          )}
        </div>
      );
    }
    if (gameState === "paused") {
      return (
        <div className="game-overlay pause">
          <h2>Paused</h2>
          <button onClick={resumeGame} className="btn secondary large">
            Resume
          </button>
          <button onClick={toStartScreen} className="btn">
            Quit
          </button>
        </div>
      );
    }
    if (gameState === "gameover") {
      return (
        <div className="game-overlay gameover">
          <h1 style={{ color: "#F44336" }}>Game Over</h1>
          <p style={{ fontSize: "1.5rem", margin: 10 }}>
            Score: <b>{score}</b>{" "}
            {score > bestScore ? (
              <span style={{ color: "#43A047" }}>🎉 NEW HIGH SCORE!</span>
            ) : null}
          </p>
          {gameMode === "timer" && (
            <div style={{
              marginTop: 8,
              fontSize: "1rem",
              color: "#4CAF50",
              marginBottom: 4,
              fontWeight: 500
            }}>
              Mode: Timer &nbsp; • &nbsp; Played for {TIMER_LENGTH} sec
            </div>
          )}
          <button
            onClick={() => startGame(gameMode)}
            className="btn primary large"
          >
            Play Again
          </button>
          <button onClick={toStartScreen} className="btn">
            Main Menu
          </button>
        </div>
      );
    }
    return null;
  }

  // Controls for mobile/desktop
  function renderControls() {
    if (gameState === "running")
      return (
        <button onClick={pauseGame} className="btn pause-btn" title="Pause">
          ❚❚
        </button>
      );
    return null;
  }

  // Top bar - score, missed, best, OR timer (contextual)
  function renderScoreBar() {
    return (
      <div className="scorebar">
        <span>
          🍏 Score: <b>{score}</b>
        </span>
        {gameMode === "timer" ? (
          <span style={{ marginLeft: 12, minWidth: 120 }}>
            <TimerBar timer={timer} total={TIMER_LENGTH} />
          </span>
        ) : (
          <span style={{ marginLeft: 14, color: "#888" }}>
            {Array.from({ length: 3 }).map((_, i) =>
              i < 3 - missed ? (
                <span key={i} role="img" aria-label="life" style={{ fontSize: '1.5em' }}>❤️</span>
              ) : (
                <span key={i} role="img" aria-label="lost" style={{ opacity: 0.25, fontSize: '1.3em' }}>💔</span>
              )
            )}
          </span>
        )}
        <span className="scorebar-best">
          🏆 Best:{" "}
          <b style={{ color: "#FF5722" }}>{Math.max(score, bestScore)}</b>
        </span>
      </div>
    );
  }

  // Timer Bar Component
  function TimerBar({ timer, total }) {
    const pct = Math.max(0, Math.min(1, timer / total));
    const accent = pct < 0.22 ? "#F44336" : pct < 0.6 ? "#FFC107" : "#43A047";
    return (
      <div style={{
        display: "flex", alignItems: "center", width: 98, margin: "0 auto"
      }}>
        <span role="img" aria-label="timer" style={{ fontSize: "1.19em", marginRight: 6 }}>⏰</span>
        <div style={{
          background: "#eee", borderRadius: 12, position: "relative", flex: 1, height: 13, minWidth: 60,
          marginRight: 5, overflow: "hidden"
        }}>
          <div style={{
            width: `${Math.round(pct * 100)}%`,
            background: accent,
            height: 13,
            borderRadius: 12,
            transition: "width 0.36s cubic-bezier(.7,1.1,.43,0.97), background 0.22s",
          }} />
        </div>
        <span style={{
          minWidth: 16, color: accent, fontWeight: 700, fontSize: "1em", textShadow: "0 1px 2px #fff"
        }}>
          {timer}
        </span>
      </div>
    );
  }

  // Theme button
  function renderThemeToggle() {
    return (
      <button
        className="theme-toggle"
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        style={{
          position: "fixed",
          top: 22,
          right: 20,
          zIndex: 401,
          background: theme === "light" ? "#FFF" : "#232323",
          color: theme === "light" ? "#F44336" : "#FFC107",
        }}
      >
        {theme === "light" ? "🌙 Dark" : "☀️ Light"}
      </button>
    );
  }

  // --- RENDER ---
  return (
    <div className={`App fruitninja-theme-${theme}`}>
      {renderThemeToggle()}
      <main>
        <div className="game-container" style={{
          margin: "32px auto 0 auto",
          maxWidth: 540,
          width: "100%",
        }}>
          {renderScoreBar()}

          <div
            className="game-board-outer"
            style={{
              background: "#f8f9fa",
              border: "2px solid #ececec",
              borderRadius: 19,
              boxShadow: "2px 6px 22px 0px rgba(76,175,80,0.08)",
              position: "relative",
              margin: "auto",
              touchAction: "none",
              userSelect: "none",
            }}
          >
            {/* svg game board */}
            <svg
              ref={boardRef}
              width={dimensions.w}
              height={dimensions.h}
              viewBox={`0 0 ${dimensions.w} ${dimensions.h}`}
              className="game-board"
              style={{ display: "block", background: "#fffbe9", borderRadius: 19 }}
              tabIndex="0"
              onPointerDown={startSlicing}
              onPointerMove={moveSlicing}
              onPointerUp={endSlicing}
              onPointerLeave={endSlicing}
              onTouchStart={startSlicing}
              onTouchMove={moveSlicing}
              onTouchEnd={endSlicing}
              aria-label="Fruit Ninja game board"
            >
              {/* game fruit and effects */}
              {/* Fruits */}
              {renderFruits()}
              {/* Bonus: floating, fading texts */}
              {renderBonusEffects()}
              {/* Slice trail */}
              {renderSliceTrails()}
              {/* Slicing Gesture Visual (highlight last active slice) */}
              {!!gesture.slicing && gesture.points.length > 2 ? (
                <polyline
                  points={gesture.points
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")}
                  fill="none"
                  stroke="#4CAF50"
                  strokeWidth="6"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              ) : null}
            </svg>

            {/* Overlay screens */}
            {renderOverlay()}
            {/* Pause/game controls */}
            {renderControls()}
          </div>
        </div>
      </main>
      <footer className="footer">
        <span>
          <span role="img" aria-label="melon">
            🍉
          </span>{" "}
          Fruit Ninja - React Edition
          <span style={{ marginLeft: 19, color: "#FFD600" }}>© Kavia</span>
        </span>
      </footer>
      {/* Style for game overlays and board */}
      <style>
        {`
        .game-container {
          width: 100%;
          padding: 16px 0 18px 0;
          min-height: 100vh;
        }
        .game-board-outer {
          width: 100%; 
          max-width: 99vw;
          min-height: 400px;
        }
        .game-board {
          width: 100%;
          max-width: 100vw;
          background: #fffbe9;
        }
        .scorebar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size:1.22rem;
          padding: 10px 8px 4px 14px;
          background: #fff;
          border-radius: 15px 15px 0 0;
          border-bottom: 2.5px solid #FFC107;
          box-shadow: 0 1px 8px rgba(252,220,80,0.04);
          min-height: 52px;
          margin-bottom: -3px;
        }
        .scorebar-best {
          color: #4CAF50;
          font-weight: 600;
        }
        .game-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 300;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.95);
          border-radius: 19px;
          animation: fadeIn 0.4s;
        }
        .game-overlay h1, .game-overlay h2 {
          font-size: 2.5rem;
          margin: 0 0 18px 0;
          font-weight: 700;
          letter-spacing: 2.5px;
        }
        .game-overlay.start .subtitle { 
          font-size: 1.2rem;
          margin-bottom: 19px;
        }
        .btn {
          padding: 10px 26px;
          font-size: 1.18rem;
          font-weight: 500;
          border-radius: 8px;
          margin: 10px 8px 0 8px;
          border: none;
          background: #ececec;
          color: #222;
          cursor: pointer;
          transition: box-shadow 0.18s, background 0.2s, color 0.18s;
        }
        .btn.primary {
          background: #4CAF50;
          color: #fff;
        }
        .btn.primary.large {
          font-size: 1.35rem;
          padding: 15px 44px;
        }
        .btn.pause-btn {
          background: #FFC107;
          color: #fff;
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 370;
          font-size: 1.7rem;
          font-weight: 800;
          border-radius: 50%;
          width: 54px;
          height: 54px;
          box-shadow: 0 2px 12px rgba(67,160,71,0.10);
        }
        .btn.secondary {
          background: #FFC107;
          color: #fff;
        }
        .btn:hover, .btn:focus {
          box-shadow: 0 3px 10px 0px rgba(67,160,71,0.14);
          outline: none;
        }
        .footer {
          margin: 32px 0 7px 0;
          text-align: center;
          color: #BDBDBD;
          opacity: 0.88;
          font-size: 1.08rem;
        }
        @media (max-width: 768px) {
          .game-board {
            max-width: 99vw !important;
            height: auto !important;
          }
          .scorebar {
            font-size: 1.01rem;
            min-height: 44px;
          }
          .footer {
            font-size: .97rem;
            margin: 18px 0 3px 0;
          }
        }
        @media (max-width:400px) {
          .footer{font-size:.78rem}
        }
        @keyframes fadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
        `}
      </style>
    </div>
  );
}

export default App;
