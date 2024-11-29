import { Collapse, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { KeyboardArrowUp, KeyboardArrowDown, Bolt, Opacity } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { Palette } from "../style.ts";
import { StatusBar } from "./StatusBar.tsx";
import { Button } from "../components/Button.tsx";
import { Timer } from "../components/Timer.tsx";
import { AppState, screenHeight } from "../xstate.ts";
import { FailedDelivery } from "../components/FailedDelivery.tsx";
import { QuickStartSelector } from "./disinfection/QuickStartSelector.tsx";
import riceImage from "../../img/Rice_chat.png";
import "../../assets/fade.css";

export const Moving = {
    Delivery() {
        const { t } = useTranslation();
        const tr = (k) => t("idle.delivery." + k);
        const [state, send] = AppState.useActor();
        const timeRemaining = state.context.tickRemain;


        return (
            <>
                <StatusBar />
                <div style={{ height: 30 }} />
                <div className="animation-bg"></div>
                <section id="moving_rice_container">
                    <div id="left_text">
                        <h2 className="title">次の場所まで</h2>
                    </div>
                    <div className="move_rice">
                        <img src={riceImage} className="gatagoto_rice" />
                    </div>
                    <div id="right_text">
                        <h2 className="title">移動中です</h2>
                    </div>
                </section>
            </>
        );
    },
}