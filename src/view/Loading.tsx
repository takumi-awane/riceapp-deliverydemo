import { motion } from "framer-motion";
import { Typography } from "@mui/material";
import { HourglassTopOutlined } from "@mui/icons-material";

import { StatusBar } from "./StatusBar.tsx";
import { Palette } from "../style.ts"
import { AppState } from "../xstate.ts";

export function Loading({ title }) {
    const [state] = AppState.useActor();
    const online = state.context.status?.online;

    return (
        <>
            {online ? <StatusBar /> : null}
            <div style={{ height: online ? 38 : 120 }} />
            <motion.div
                animate={{ rotate: [360, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop", repeatDelay: 1 }}
                style={{ width: "50%", margin: "auto" }}
            >
                <HourglassTopOutlined style={{ fontSize: 200, color: Palette.orange }} />
            </motion.div>
            <div style={{ height: 40 }} />
            <Typography variant="h3" fontWeight="bold">{title}</Typography>
        </>
    )
}