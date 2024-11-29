import { Typography } from "@mui/material";
import { LocalShipping } from '@mui/icons-material';
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Palette } from "../../style.ts";
import { StatusBar } from "../StatusBar.tsx";
import { AppState } from "../../xstate.ts";

export function Delivering() {
    const { t } = useTranslation();
    const [ state ] = AppState.useActor();
    const destination = state.context.mission.meta.to;
    const name = state.context.info.site.map.points[destination].name;

    return (
        <>
            <StatusBar />
            <div style={{ height: 60 }} />
            <motion.div animate={{ opacity: [0, 1, 0], x: [-400, 0, 400] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                <LocalShipping style={{ fontSize: 200, color: Palette.cyan }} />
            </motion.div>
            <div style={{ height: 20 }} />
            <Typography variant="h3" fontWeight="bold" style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", WebkitLineClamp: 2 }}>
                {t("delivery.delivering", { dest: name ?? destination })}
            </Typography>
        </>
    );
}