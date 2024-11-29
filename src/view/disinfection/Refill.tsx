import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { KeyboardArrowUp, KeyboardArrowDown, Bolt, CardGiftcard } from "@mui/icons-material";

import { StatusBar } from "../StatusBar.tsx"
import { Palette } from "../../style.ts"
import { AppState } from "../../xstate.ts";
import { Button } from "../../components/Button.tsx";


export function Refill() {
    const { t } = useTranslation();
    const tr = (k, opt = {}) => t("refill." + k, opt);
    const [state, send] = AppState.useActor();
    const [color, setColor] = useState<string>(Palette.mint);
    const [bgColor, setBgColor] = useState<string>("rgb(0, 199, 190, 0.2)");

    return (
        <>
            <StatusBar />
            <div style={{ height: 10 }} />
            <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ textAlign: "center", width: "100%", display: "flex", justifyContent: "flex-end", flexDirection: "column" }}>
                    <div style={{ height: 10 }} />
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            flexDirection: "column",
                            width: "100%",
                        }}
                    >
                        <CardGiftcard style={{ fontSize: 160, color: Palette.blue }} />
                        <Typography fontSize={50} variant="overline" fontWeight="bold" display="block" color={Palette.black}>
                            {tr("title")}
                        </Typography>
                        <div style={{ height: 10 }} />
                        <Button onClick={() => send("filled")} color={Palette.blue} style={{ textAlign: "center", width: "50%" }}>
                            <Typography variant="h3" fontWeight="bold">{tr("return")}</Typography>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
