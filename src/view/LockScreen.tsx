import { useMemo, useState } from "react";
import { Typography } from "@mui/material";
import { Lock, Circle, RadioButtonUnchecked, KeyboardArrowLeft} from '@mui/icons-material';
import { motion, useAnimate } from "framer-motion";

import { Palette } from "../style.ts";
import { NumberPad } from "../components/NumberPad.tsx";
import { timeout } from "../util.ts";
import { SoundEffect, playSoundEffect } from "../helper/sfx.ts";

export function LockScreen({ instructions, password, onSuccess, onBack }: {
    instructions: string;
    password: string;
    onSuccess: () => void;
    onBack?: () => void;
}) {
    const [lockIconRef, animate] = useAnimate();
    const [userPassword, setUserPassword] = useState("");
    const paddedPassword = useMemo(() => userPassword.padEnd(4, "X").split(""), [userPassword]);

    async function updatePassword(value: string) {
        setUserPassword(value);
        if (value === password) {
            await timeout(500);
            await playSoundEffect(SoundEffect.unlock);
            onSuccess();
        } else if (value.length === password.length) {
            await timeout(500);
            await playSoundEffect(SoundEffect.alert);
            setUserPassword("");
            animate(lockIconRef.current, { x: [7, -7, 7, -7, 7, -7, 0] }, { duration: 0.35 });
        }
    }

    return (
        <div style={{ width: "100%", display: "flex", height: "100%", textAlign: "center" }}>
            {onBack ? <KeyboardArrowLeft style={{ position: "absolute", top: 20, left: 20, fontSize: 40, color: Palette.darkGrey }} onClick={() => onBack()} /> : null}
            <div
                style={{
                    width: "50%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                }}
            >
                <Typography variant="h4" fontWeight="bold" style={{ width: 400, whiteSpace: "pre-wrap" }}>{instructions}</Typography>
                <div style={{ height: 50 }} />
                <div>
                    <motion.div ref={lockIconRef}><Lock style={{ fontSize: 100, color: Palette.darkGrey }} /></motion.div>
                    <div style={{ height: 30 }} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                        {paddedPassword.map((x, i) => x === "X" ? (
                            <RadioButtonUnchecked key={`${i}_${x}_on`} fontSize="large" style={{ color: Palette.darkGrey }} />
                        ) : (
                            <Circle key={`${i}_${x}_off`} fontSize="large" style={{ color: Palette.darkGrey }} />
                        ))}
                    </div>
                </div>
            </div>
            <div style={{ height: "70%", margin: "auto", width: 1, backgroundColor: Palette.grey }} />
            <div
                style={{
                    width: "50%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    overflow: "hidden",
                }}
            >
                <div style={{ width: 350 }}>
                    <NumberPad number={userPassword} onChange={(value) => updatePassword(value.substring(0, 4))} specialCharacter="#" />
                </div>
            </div>
        </div>
    );
}