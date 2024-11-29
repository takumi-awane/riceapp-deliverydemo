import { Collapse, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { KeyboardArrowUp, KeyboardArrowDown, Bolt, Opacity } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

import { Palette } from "../style.ts";
import { StatusBar } from "./StatusBar.tsx";
import { AppState, screenHeight } from "../xstate.ts";
import riceImage from "../img/Rice_chat.png";
import "../fade.css";

export const Navigate = {
    Chat() {
        const { t } = useTranslation();
        const [state, send] = AppState.useActor();

        return (
            <>
                <div style={{ height: 5 }} />
                <div className="animation-bg"></div>
                <section id="moving_rice_container">
                    <div id="left_text">
                        <h2 className="title">配送先に</h2>
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