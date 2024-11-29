import { motion } from "framer-motion";
import { Typography } from "@mui/material";
import { Settings } from "@mui/icons-material";

import { StatusBar } from "../StatusBar.tsx";
import { Palette } from "../../style.ts";
import { AppState } from "../../xstate.ts";

export function Running({stage}) {
    const [state] = AppState.useActor();
    return (
        <>
            {state.context.status?.online ? <StatusBar /> : null}
            <div style={{ height: state.context.status?.online ? 38 : 120 }} />
            <motion.div
                animate={{ rotate: [-360, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop", repeatDelay: 1 }}
                style={{ width: "50%", margin: "auto" }}
            >
                <Settings style={{ fontSize: 200, color: Palette.purple }} />
            </motion.div>
            <div style={{ height: 40 }} />
            <Typography variant="h3" fontWeight="bold">Running tests</Typography>
            <div style={{ height: 20 }} />
            <Typography variant="h5">Current stage: {stage}</Typography>
        </>
    )
}