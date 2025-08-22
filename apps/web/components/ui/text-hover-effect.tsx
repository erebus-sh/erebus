"use client";
import React, { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";

export const TextHoverEffect = ({ text }: { text: string }) => {
  // Smoothness control constants
  const CURSOR_INTERPOLATION = 0.15;
  const SPRING_STIFFNESS = 200;
  const SPRING_DAMPING = 30;
  const SPRING_MASS = 0.8;

  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
  const [smoothCursor, setSmoothCursor] = useState({ x: 0, y: 0 });

  // Initialize smooth cursor when mouse enters
  useEffect(() => {
    if (hovered && svgRef.current) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const centerX = svgRect.left + svgRect.width / 2;
      const centerY = svgRect.top + svgRect.height / 2;
      setSmoothCursor({ x: centerX, y: centerY });
    }
  }, [hovered]);

  useEffect(() => {
    if (svgRef.current && smoothCursor.x !== null && smoothCursor.y !== null) {
      const svgRect = svgRef.current.getBoundingClientRect();
      const cxPercentage =
        ((smoothCursor.x - svgRect.left) / svgRect.width) * 100;
      const cyPercentage =
        ((smoothCursor.y - svgRect.top) / svgRect.height) * 100;
      setMaskPosition({
        cx: `${cxPercentage}%`,
        cy: `${cyPercentage}%`,
      });
    }
  }, [smoothCursor]);

  // Smooth cursor tracking with interpolation
  useEffect(() => {
    let animationFrame: number;
    const updateSmoothCursor = () => {
      setSmoothCursor((prev) => ({
        x: prev.x + (cursor.x - prev.x) * CURSOR_INTERPOLATION,
        y: prev.y + (cursor.y - prev.y) * CURSOR_INTERPOLATION,
      }));
      animationFrame = requestAnimationFrame(updateSmoothCursor);
    };

    if (hovered) {
      animationFrame = requestAnimationFrame(updateSmoothCursor);
    }

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [cursor, hovered]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 300 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className="select-none"
    >
      <defs>
        <linearGradient
          id="textGradient"
          gradientUnits="userSpaceOnUse"
          cx="50%"
          cy="50%"
          r="25%"
        >
          {hovered && (
            <>
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="25%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="75%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="20%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{
            type: "spring",
            stiffness: SPRING_STIFFNESS,
            damping: SPRING_DAMPING,
            mass: SPRING_MASS,
          }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="url(#revealMask)"
          />
        </mask>
      </defs>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="fill-transparent stroke-neutral-200 font-[helvetica] text-7xl font-bold dark:stroke-neutral-800"
        style={{ opacity: hovered ? 0.7 : 0 }}
      >
        {text}
      </text>
      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.3"
        className="fill-transparent stroke-neutral-200 font-[helvetica] text-7xl font-bold dark:stroke-neutral-800"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1000,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="url(#textGradient)"
        strokeWidth="0.3"
        mask="url(#textMask)"
        className="fill-transparent font-[helvetica] text-7xl font-bold"
      >
        {text}
      </text>
    </svg>
  );
};
