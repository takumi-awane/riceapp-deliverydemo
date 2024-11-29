import { Collapse, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { KeyboardArrowUp, KeyboardArrowDown, Pets, Bolt, Opacity, Home, PresentToAll } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { Palette } from "../style.ts";
import { StatusBar } from "./StatusBar.tsx";
import { Button } from "../components/Button.tsx";
import { Timer } from "../components/Timer.tsx";
import { AppState, screenHeight } from "../xstate.ts";
import { FailedDelivery } from "../components/FailedDelivery.tsx";
import { QuickStartSelector } from "./disinfection/QuickStartSelector.tsx";

export const GetItem = {
    Delivery() {
        const { t } = useTranslation();
        const tr = (k) => t("idle.delivery." + k);
        const [state, send] = AppState.useActor();
        const [welcomePhrase] = useState(tr(`welcome.${Math.floor(Math.random() * 19)}`));
        const timeRemaining = state.context.tickRemain;


        function generateGreetings() {
            const now = new Date();
            const hour = now.getHours();
            if (hour < 12) return tr("morning");
            else if (hour < 18) return tr("afternoon");
            else return tr("evening");
        }

        return (
            <>
                <StatusBar
                    central={
                        <>
                        </>
                    }
                />
                <div style={{ height: 30 }} />
                <Home style={{ fontSize: 160, color: Palette.blue }} />
                <div style={{ height: 20 }} />
                <Typography fontSize={40} fontWeight="bold" style={{ lineHeight: "inherit", padding: "0px 50px", whiteSpace: "break-spaces" }} color={Palette.darkGrey}>
                    {tr("home")}
                </Typography>
                <div style={{ height: 40 }} />
                <div style={{ textAlign: "center", display: "flex", justifyContent: "center" }}>
                    <Button onClick={() => send("toRefill")} color={Palette.green} style={{ width: "30%", marginRight: "20px" }}>
                        <Typography variant="h4" fontWeight="bold">{tr("refill")}</Typography>
                        <PresentToAll style={{ marginLeft: "10px", fontSize: 45 }} />
                    </Button>
                    <Button onClick={() => send("toCharging")} color={Palette.cyan} style={{ width: "30%" }}>
                        <Typography variant="h4" fontWeight="bold">{tr("return")}</Typography>
                        <Pets style={{ marginLeft: "10px", fontSize: 45 }} />
                    </Button>
                </div>
            </>
        );
    },
}