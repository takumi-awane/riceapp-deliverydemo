import { Typography } from "@mui/material";
import { Backspace } from '@mui/icons-material';
import { motion } from "framer-motion";

import { Palette } from "../style.ts";
import { SoundEffect, playSoundEffect } from "../helper/sfx.ts";

export function NumberPad({ number, specialCharacter, onChange }: {
    number: string;
    specialCharacter: "+" | "." | "#";
    onChange: (value: string) => void;
}) {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", specialCharacter, "0", "del"];

    async function handleKeyPress(key: string) {
        await playSoundEffect(SoundEffect.input);
        const newNumber = key === "del" ? number.substring(0, number.length - 1) : `${number}${key}`;
        onChange(newNumber);
    }

    return (
        <div style={{ width: "100%", display: "flex", flexWrap: "wrap" }}>
            {keys.map(x => (
                <motion.div
                    key={x}
                    style={{ width: "33%", borderRadius: 20 }}
                    transition={{ duration: 0.2, type: "spring", stiffness: 100, damping: 20 }}
                    whileTap={{ scale: 0.8, backgroundColor: Palette.lightgrey }}
                    onClick={() => handleKeyPress(x)}
                >
                    <Typography variant="button" fontSize={50}>
                        {x === "del" ? <Backspace style={{ fontSize: 40 }} /> : x}
                    </Typography>
                </motion.div>
            ))}
        </div >
    );
}
