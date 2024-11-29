import { ErrorOutline } from "@mui/icons-material";
import { motion } from "framer-motion";
import { Typography } from "@mui/material";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Palette } from "../style.ts"
import { SoundEffect, playSoundEffect } from "../helper/sfx.ts";

export function FatalError() {
    const { t } = useTranslation();

    useEffect(() => {
        const interval = setInterval(() => playSoundEffect(SoundEffect.error), 15000);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div style={{ height: 100 }} />
            <motion.div
                animate={{ opacity: [0, 1, 0], scale: [1, 1.1]}}
                transition={{ duration: 1, repeat: Infinity, repeatType: "loop", ease: "easeIn" }}
                style={{ width: "50%", margin: "auto" }}
            >
                <ErrorOutline style={{ fontSize: 200, color: Palette.red }} />
            </motion.div>
            <div style={{ height: 20 }} />
            <Typography variant="h3" fontWeight="bold" color={Palette.red}>
                {t("fatalError.title")}
            </Typography>
            <div style={{ height: 10 }} />
            <Typography variant="h5" color={Palette.red}>
                {t("fatalError.subtitle")}
            </Typography>
            <div style={{ height: 50 }} />
        </>
    );
}
