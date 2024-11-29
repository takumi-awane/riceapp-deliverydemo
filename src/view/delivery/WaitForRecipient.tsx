import { motion } from "framer-motion";
import { Typography } from "@mui/material";
import { Inventory } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { StatusBar } from "../StatusBar.tsx";
import { AppState } from "../../xstate.ts";
import { Timer } from "../../components/Timer.tsx";
import { Palette } from "../../style.ts";
import { Button } from "../../components/Button.tsx";

export function WaitForRecipient() {
    const { t } = useTranslation();
    const tr = (k) => t("delivery.waitForRecipient." + k);
    const [state, send] = AppState.useActor();
    const timeRemaining = state.context.tickRemain;

    return (
        <>
            <StatusBar central={<Timer seconds={timeRemaining} />} />
            <div style={{ height: 40 }} />
            <motion.div
                animate={{ y: [-60, 0, -30, 0, -10, 0], rotate: [15, 0, -10, 0, 5, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatType: "loop", repeatDelay: 2 }}
                style={{ width: "50%", margin: "auto" }}
            >
                <Inventory style={{ fontSize: 200, color: Palette.brown }}/>
            </motion.div>
            <div style={{ height: 10 }} />
            <Typography variant="h3" fontWeight="bold">{tr("title")}</Typography>
            <div style={{ height: 60 }} />
            <Button onClick={() => send({type: "recipientInteracted"})} color={Palette.blue} style={{ width: "40%", margin: "auto" }} requiresUnlock={true}>
                <Typography variant="h4" fontWeight="bold">{tr("collect")}</Typography>
            </Button>
        </>
    )
}
