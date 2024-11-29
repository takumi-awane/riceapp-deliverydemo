import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Fade, Typography, Collapse } from "@mui/material";
import { KeyboardArrowDown, KeyboardArrowUp, EvStation } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { Battery } from "../components/Battery.tsx";
import { Button } from "../components/Button.tsx";
import { Palette } from "../style.ts";
import { AppState, screenHeight } from "../xstate.ts";
import { QuickStartSelector } from "./disinfection/QuickStartSelector.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { SkippedDisinfection } from "../components/SkippedDisinfection.tsx";

export const Charging = {
    Delivery() {
        const { t } = useTranslation();
        const tr = (k, opt = {}) => t("charging.delivery." + k, opt);
        const [ state, send ] = AppState.useActor();
        const [showPercentage, setShowPercentage] = useState(false);
        const [time, setTime] = useState(new Date());
        const timeoutHandle = useRef<NodeJS.Timeout>();
        const { locale } = state.context.info.site;
        const { charge, charging } = state.context.status;
        const { minBatteryWakeup } = state.context.info.params;
        const insufficientCharge = charge < minBatteryWakeup;

        useEffect(() => {
            const clockInterval = setInterval(() => setTime(new Date()), 1000);
            return () => clearInterval(clockInterval);
        }, []);

        function togglePercentage() {
            clearTimeout(timeoutHandle.current);
            if (showPercentage) {
                setShowPercentage(false);
            } else {
                setShowPercentage(true);
                timeoutHandle.current = setTimeout(() => setShowPercentage(false), 5000);
            }
        }

        return (
            <>
                <div style={{ height: 70 }} />
                <Typography fontSize={30} color={Palette.darkGrey} style={{ lineHeight: "inherit" }}>
                    {time.toLocaleDateString(locale, { dateStyle: "full" })}
                </Typography>
                <Typography fontSize={120} style={{ lineHeight: "inherit" }}>
                    {time.toLocaleTimeString(locale, { hour12: false, hour: "2-digit", minute: "2-digit" })}
                </Typography>
                <div style={{ height: 30 }} />
                <div onClick={togglePercentage}>
                    <Battery
                        width={230}
                        height={70}
                        percentage={charge}
                        isCharging={charging ?? false}
                        theme="dark"
                    />
                </div>
                <Fade in={showPercentage}>
                    <Typography variant="h6" color={Palette.grey}>
                        {Math.round(charge ?? 0)}%
                    </Typography>
                </Fade>
                <div style={{ height: 30 }} />
                <Button onClick={() => send("wake")} color={Palette.blue} style={{ width: "35%", margin: "auto" }} disabled={insufficientCharge && !charging}>
                    <Typography variant="h4" fontWeight="bold">
                        {tr("welcome")}
                    </Typography>
                </Button>
                <div style={{ height: 10 }} />
                {insufficientCharge ? (
                    <Typography display="block" color={Palette.darkGrey}>
                        {tr("waitBattery", { minBattery: minBatteryWakeup })}
                    </Typography>
                ) : null}
            </>
        );
    },
    Disinfection() {
        const { t } = useTranslation();
        const tr = (k, opt = {}) => t("charging.disinfection." + k, opt);
        const [ state, send ] = AppState.useActor();
        const [time, setTime] = useState(new Date());
        const [showQuickSelector, setShowQuickSelector] = useState(false);
        const { locale } = state.context.info.site;
        const { upcoming } = state.context.scheduler;
        const { minBatteryDisinfection } = state.context.info.params;
        const insufficientCharge = state.context.status.charge < minBatteryDisinfection;
        const isSkippedDisinfection = state.context.mission?.state === "skip";

        useEffect(() => {
            const clockInterval = setInterval(() => {
                setTime(new Date());
            }, 1000);
            return () => clearInterval(clockInterval);
        }, []);

        return (
            <>
                <div style={{ height: "100%" }}>
                    <StatusBar
                        central={
                            <>
                                {isSkippedDisinfection ? (
                                    <SkippedDisinfection
                                        pathId={state.context.mission?.meta?.pathId}
                                        repetition={state.context.mission?.meta?.repetition}
                                        clear={() => send("clear")}
                                    />
                                ) : null}
                            </>
                        }
                    />
                    <Collapse in={!showQuickSelector}>
                        <Typography style={{ lineHeight: "inherit" }} fontSize={20} variant="overline" display="block" color={upcoming ? Palette.orange : Palette.grey}>
                            {upcoming ? tr("next") : tr("noSched")}
                        </Typography>
                        <div style={{ height: 10 }} />
                        <Typography fontSize={120} style={{ lineHeight: "inherit" }}>
                            {(upcoming ? new Date(upcoming[0]) : time).toLocaleTimeString(locale, { hour12: false, hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                        <Typography fontSize={30} style={{ lineHeight: "inherit" }} color={Palette.darkGrey}>
                            {(upcoming ? new Date(upcoming[0]) : time).toLocaleDateString(locale, { dateStyle: "full" })}
                        </Typography>
                        <div style={{ height: 50 }} />
                        <Battery
                            width={250}
                            height={85}
                            percentage={state.context.status.charge}
                            isCharging={state.context.status.charging ?? false}
                            theme="dark"
                        />
                        <Typography display="block" color={Palette.darkGrey} style={{ visibility: insufficientCharge ? "unset" : "hidden" }}>
                            {tr("waitBattery", { minBattery: minBatteryDisinfection })}
                        </Typography>
                        <div style={{ height: 10 }} />
                    </Collapse>
                    <div onClick={() => setShowQuickSelector(!showQuickSelector)} style={{ width: "fit-content", margin: "auto", height: 50 }}>
                        {showQuickSelector ? (
                            <KeyboardArrowDown style={{ color: Palette.grey }} fontSize="large" />
                        ) : (
                            <KeyboardArrowUp style={{ color: Palette.grey }} fontSize="large" />
                        )}
                        <Typography variant="overline" color={Palette.grey} display="block" style={{ lineHeight: 0 }}>
                            {showQuickSelector ? tr("hide") : tr("more")}
                        </Typography>
                    </div>
                    <Collapse in={showQuickSelector}>
                        <div style={{ height: screenHeight - 100, overflow: "auto" }}>
                            <QuickStartSelector />
                        </div>
                    </Collapse>
                </div>
            </>
        );
    },
    Docking() {
        const { t } = useTranslation();
        const [state] = AppState.useActor();
        const online = state.context.status?.online;

        return (
            <>
                {online ? <StatusBar /> : null}
                <div style={{ height: online ? 38 : 120 }} />
                <motion.div
                    animate={{ opacity: [0, 1, 0], scale: [1, 1.1]}}
                    transition={{ duration: 1.4, repeat: Infinity, repeatType: "loop", ease: "easeIn" }}
                    style={{ width: "50%", margin: "auto" }}
                >
                    <EvStation style={{ fontSize: 200, color: Palette.orange }} />
                </motion.div>
                <div style={{ height: 40 }} />
                <Typography variant="h3" fontWeight="bold">
                    {t("charging.docking")}
                </Typography>
            </>
        );
    }
}