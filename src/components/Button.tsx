import { ReactNode } from "react";
import { Lock } from '@mui/icons-material';
import { motion } from "framer-motion";

import { SoundEffect, playSoundEffect } from "../helper/sfx.ts";
import { Palette } from "../style.ts";

const animationTime = 0.2;

export function Button({ onClick, color, disabled = false, requiresUnlock = false, style = {}, children }: {
    onClick: () => void;
    color: Palette;
    disabled?: boolean;
    requiresUnlock?: boolean;
    requiresAnimationDelay?: boolean;
    style?: { [key: string]: any; };
    children?: ReactNode;
}) {

    async function buttonClick() {
        if (disabled) return;
        await playSoundEffect(SoundEffect.confirm);
        onClick();
    }

    return (
        <>
            <motion.div
                onClick={buttonClick}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: animationTime, type: "spring", stiffness: 100, damping: 15 }}
                style={{
                padding: "15px 30px",
                backgroundColor: disabled ? Palette.grey : color,
                borderRadius: 50,
                color: "white",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                ...style,
                }}
            >
                {requiresUnlock ? <><Lock /><div style={{ width: 15 }} /></> : null}
                {children}
            </motion.div>
        </>
    );
}