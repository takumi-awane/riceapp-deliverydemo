import { MoveToInbox } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { StatusBar } from "../StatusBar.tsx"
import { AppState } from "../../xstate.ts"
import { Timer } from "../../components/Timer.tsx";
import { Palette } from "../../style.ts";
import { Button } from "../../components/Button.tsx";

export function ItemPlacing() {
    const { t } = useTranslation();
    const tr = (k) => t("delivery.placeItems.itemPlacing." + k);
    const [ state, send ] = AppState.useActor();
    const timeRemaining = state.context.tickRemain;

    return (
        <>
            <StatusBar central={<Timer seconds={timeRemaining} />} />
            <div style={{ height: 30 }} />
            <motion.div animate={{ y: [10, -10] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}>
                <MoveToInbox style={{ fontSize: 200, color: Palette.cyan }} />
            </motion.div>
            <div style={{ height: 20 }} />
            <Typography variant="h3" fontWeight="bold">
                {tr("title")}
            </Typography>
            <div style={{ height: 50 }} />
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={3}>
                <Button onClick={() => send("back")} color={Palette.darkGrey} style={{ width: "25%" }} >
                    <Typography variant="h4" fontWeight="bold">{tr("back")}</Typography>
                </Button>
                <Button onClick={() => send("itemPlaced")} color={Palette.green} style={{ width: "25%" }} >
                    <Typography variant="h4" fontWeight="bold">{tr("continue")}</Typography>
                </Button>
            </Stack>
        </>
    );
}