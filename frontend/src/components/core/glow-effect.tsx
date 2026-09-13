"use client";
import { motion, Transition, TargetAndTransition } from "motion/react";
import React from "react";

export type GlowEffectProps = {
  className?: string;
  style?: React.CSSProperties;
  colors?: string[];
  mode?:
    | "rotate"
    | "pulse"
    | "breathe"
    | "colorShift"
    | "flowHorizontal"
    | "static";
  blur?: number | "soft" | "medium" | "strong" | "none";
  transition?: Transition;
  scale?: number;
  duration?: number;
};

export function GlowEffect({
  className,
  style,
  colors = ["#FF5733", "#33FF57", "#3357FF", "#F1C40F"],
  mode = "rotate",
  blur = "medium",
  transition,
  scale = 1,
  duration = 5,
}: GlowEffectProps) {
  const BASE_TRANSITION = {
    repeat: Infinity,
    duration,
    ease: "linear" as const,
  };

  const animations: Record<NonNullable<GlowEffectProps["mode"]>, TargetAndTransition> = {
    rotate: {
      background: [
        `conic-gradient(from 0deg at 50% 50%, ${colors.join(", ")})`,
        `conic-gradient(from 360deg at 50% 50%, ${colors.join(", ")})`,
      ],
      transition: { ...(transition ?? BASE_TRANSITION) },
    },
    pulse: {
      background: colors.map(
        (color) =>
          `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
      ),
      scale: [1 * scale, 1.1 * scale, 1 * scale],
      opacity: [0.5, 0.8, 0.5],
      transition: {
        ...(transition ?? { ...BASE_TRANSITION, repeatType: "mirror" as const }),
      },
    },
    breathe: {
      background: colors.map(
        (color) =>
          `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 100%)`
      ),
      scale: [1 * scale, 1.05 * scale, 1 * scale],
      transition: {
        ...(transition ?? { ...BASE_TRANSITION, repeatType: "mirror" as const }),
      },
    },
    colorShift: {
      background: colors.map((color, index) => {
        const nextColor = colors[(index + 1) % colors.length];
        return `conic-gradient(from 0deg at 50% 50%, ${color} 0%, ${nextColor} 50%, ${color} 100%)`;
      }),
      transition: {
        ...(transition ?? { ...BASE_TRANSITION, repeatType: "mirror" as const }),
      },
    },
    flowHorizontal: {
      background: colors.map((color, index) => {
        const nextColor = colors[(index + 1) % colors.length];
        return `linear-gradient(to right, ${color}, ${nextColor})`;
      }),
      transition: {
        ...(transition ?? { ...BASE_TRANSITION, repeatType: "mirror" as const }),
      },
    },
    static: {
      background: `linear-gradient(to right, ${colors.join(", ")})`,
    },
  };

  const getBlurClass = (blurValue: GlowEffectProps["blur"]) => {
    if (typeof blurValue === "number") {
      return `blur-[${blurValue}px]`;
    }
    const presets = {
      none: "blur-none",
      soft: "blur-sm",
      medium: "blur-md",
      strong: "blur-lg",
    };
    return presets[blurValue as keyof typeof presets];
  };

  const baseClassName = `pointer-events-none absolute inset-0 h-full w-full ${getBlurClass(
    blur
  )}`;

  return (
    <motion.div
      style={
        {
          ...style,
          "--scale": scale,
          willChange: "transform",
          backfaceVisibility: "hidden",
        } as React.CSSProperties
      }
      animate={animations[mode]}
      className={className ? `${baseClassName} ${className}` : baseClassName}
    />
  );
}
