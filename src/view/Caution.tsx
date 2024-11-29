import { motion } from "framer-motion";
import { Warning } from "@mui/icons-material";
import { Typography } from "@mui/material";

import { StatusBar } from "./StatusBar.tsx";
import { Palette } from "../style.ts";
import { AppState } from "../xstate.ts";

export function Caution({title, subtitle}) {
    const [state] = AppState.useActor();
    const online = state.context.status?.online;

    return (
        <>
            {online ? <StatusBar /> : null}
            <div style={{ height: online ? 38 : 120 }} />
            <motion.div
                animate={{ opacity: [0, 1, 0], scale: [1, 1.1]}}
                transition={{ duration: 1, repeat: Infinity, repeatType: "loop", ease: "easeIn" }}
                style={{ width: "50%", margin: "auto" }}
            >
                <Warning style={{ fontSize: 200, color: Palette.orange }} />
            </motion.div>
            <div style={{ height: 40 }} />
            <Typography variant="h3" fontWeight="bold">{title}</Typography>
            <div style={{ height: 20 }} />
            <Typography variant="h5">{subtitle}</Typography>
        </>
    )
}