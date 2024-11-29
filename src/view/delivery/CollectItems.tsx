import { motion } from "framer-motion";
import { Typography } from "@mui/material";
import { Redeem } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { Timer } from "../../components/Timer.tsx";
import { StatusBar } from "../StatusBar.tsx";
import { AppState } from "../../xstate.ts";
import { Palette } from "../../style.ts";
import { Button } from "../../components/Button.tsx";

export function CollectItems() {
    const { t } = useTranslation();
    const tr = (k) => t("delivery.collectItems." + k);
    const [ state, send ] = AppState.useActor();
    const timeRemaining = state.context.tickRemain;

    return(
        <>
            <StatusBar central={<Timer seconds={timeRemaining} />} />
            <div style={{ height: 40 }} />
            <motion.div
                animate={{ y: [-60, 0, -30, 0, -10, 0], rotate: [15, 0, -10, 0, 5, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop", repeatDelay: 2 }}
                style={{ width: "50%", margin: "auto" }}
            >
                <Redeem style={{ fontSize: 200, color: Palette.cyan }} />
            </motion.div>
            <div style={{ height: 10 }} />
            <Typography variant="h3" fontWeight="bold">
                {tr("collect")}
            </Typography>
            <div style={{ height: 60 }} />
            <Button onClick={() => send({type: "itemCollected"})} color={Palette.blue} style={{ width: "40%", margin: "auto" }}>
                <Typography variant="h4" fontWeight="bold">
                    {tr("complete")}
                </Typography>
            </Button>
        </>
    );
}