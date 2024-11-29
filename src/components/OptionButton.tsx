import { ReactNode } from "react";
import { motion } from "framer-motion";

import { SoundEffect, playSoundEffect } from "../helper/sfx.ts";
import { Palette } from "../style.ts"

export function OptionButton({ onClick, color, isSelected, style = {}, children }: {
    onClick: () => void;
    color: Palette;
    isSelected: boolean;
    style?: { [key: string]: any; };
    children?: ReactNode;
}) {
    async function buttonClick() {
        await playSoundEffect(SoundEffect.input);
        onClick();
    }

    return (
        <>
            <motion.div
                onClick={buttonClick}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: animationTime, type: "spring", stiffness: 100, damping: 15 }}
                style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "fit-content",
                    padding: "10px 20px",
                    borderRadius: 10,
                    color: isSelected ? Palette.white : color,
                    backgroundColor: isSelected ? color : "transparent",
                    border: `2px solid ${color}`,
                    ...style,
                }}
            >
                {children}
            </motion.div>
        </>
    );
}

const animationTime = 0.2;