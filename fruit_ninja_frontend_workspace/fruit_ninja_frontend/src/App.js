import React, { useEffect, useRef, useState } from "react";
import "./App.css";

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
  },
  {
    name: "🍉",
    color: "#4CAF50",
    radius: 38,
  },
  {
    name: "🍋",
    color: "#FFC107",
    radius: 34,
  },
  {
    name: "🥝",
    color: "#009688",
    radius: 34,
  },
  {
    name: "🍊",
    color: "#FF9800",
    radius: 32,
  },
  {
    name: "🍌",
    color: "#FFD600",
    radius: 30,
  },
];

// For random fruit launch properties
function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

// Fruit spawn logic
function createFruit(boardWidth, boardHeight) {
  const fruitType = FRUITS[Math.floor(Math.random() * FRUITS.length)];
  const x = randomBetween(
    fruitType.radius + 40,
    boardWidth - fruitType.radius - 40
  );
  // initial y: below the bottom of the board
  return {
    id: `fruit_${Date.now()}_${Math.random()}`,
    ...fruitType,
    x,
    y: boardHeight + fruitType.radius,
    velocityX: randomBetween(-2, 2),
    // Launch higher: increase initial upward velocity range (more negative value)
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

// PUBLIC_INTERFACE
function App() {
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

  // For slicing gestures
  const [gesture, setGesture] = useState({
    slicing: false,
    points: [],
  });

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

  // Handle best score
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem("fruitninja_best", score.toString());
    }
  }, [score, bestScore]);

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
              // Missed if not sliced
              newMissed++;
            }
          }
        });
        if (newMissed > 0) {
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
      if (runningRef.current)
        animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);
    return () => animFrameRef.current && cancelAnimationFrame(animFrameRef.current);
    // eslint-disable-next-line
  }, [gameState, dimensions, score, missed]);

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

    setFruits((oldFruits) =>
      oldFruits.map((fruit) => {
        if (
          !fruit.sliced &&
          isFruitSliced(fruit, x1, y1, x2, y2)
        ) {
          // Add to score!
          setScore((oldScore) => oldScore + 1);
          // Visual slice line:
          fruit.sliceLine = { x1, y1, x2, y2 };
          fruit.sliceAngle = Math.atan2(y2 - y1, x2 - x1);
          fruit.sliced = true;
        }
        return { ...fruit };
      })
    );
  }

  // PUBLIC_INTERFACE
  function endSlicing(evt) {
    if (gameState !== "running") return;
    evt && evt.preventDefault();
    setGesture({ slicing: false, points: [] });
  }

  // Reset Game
  // PUBLIC_INTERFACE
  function startGame() {
    setScore(0);
    setMissed(0);
    setFruits([]);
    setSliceTrails([]);
    timeSinceLastFruit.current = 0;
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
      // Not sliced: normal fruit
      if (!fruit.sliced) {
        return (
          <g
            key={fruit.id}
            style={{
              pointerEvents: "none",
              filter: "drop-shadow(0 2px 7px rgba(0,0,0,0.16))",
            }}
          >
            <circle
              cx={fruit.x}
              cy={fruit.y}
              r={fruit.radius}
              fill={fruit.color}
              opacity={0.88}
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
              }}
            >
              {fruit.name}
            </text>
          </g>
        );
      } else {
        // Sliced: show split + simple effect
        // Show fruit in 2 mirrored halves, separated by slice angle
        const dx = Math.cos(fruit.sliceAngle || 0) * fruit.radius * 0.7;
        const dy = Math.sin(fruit.sliceAngle || 0) * fruit.radius * 0.7;
        return (
          <g
            key={fruit.id + "_sliced"}
            filter="drop-shadow(0 3px 8px rgba(80,0,0,0.14))"
          >
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
            Swipe to slice!<br />
            Score points. Miss 3 fruits and it's GAME OVER.
          </p>
          <button onClick={startGame} className="btn primary large">
            Start Game
          </button>
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
          <button onClick={startGame} className="btn primary large">
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

  // Top bar - score, missed, best
  function renderScoreBar() {
    return (
      <div className="scorebar">
        <span>
          🍏 Score: <b>{score}</b>
        </span>
        <span style={{ marginLeft: 14, color: "#888" }}>
          {Array.from({ length: 3 }).map((_, i) =>
            i < 3 - missed ? (
              <span key={i} role="img" aria-label="life" style={{fontSize:'1.5em'}}>❤️</span>
            ) : (
              <span key={i} role="img" aria-label="lost" style={{opacity:0.25,fontSize:'1.3em'}}>💔</span>
            )
          )}
        </span>
        <span className="scorebar-best">
          🏆 Best:{" "}
          <b style={{ color: "#FF5722" }}>{Math.max(score, bestScore)}</b>
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
