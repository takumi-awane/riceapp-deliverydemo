import { Home } from "@mui/icons-material";
import { Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { Palette } from "../style.ts";
import { StatusBar } from "./StatusBar.tsx";
// import { sendBlockedAlert } from "../helper/Alert";

export function ReturnHome() {
    const { t } = useTranslation();
    return (
        <>
            <StatusBar />
            <div style={{ height: 20 }} />
            <Home style={{ height: 300, width: 300, color: Palette.teal }} />
            <div style={{ height: 10 }} />
            <Typography variant="h3" fontWeight="bold">
                {t("returnHome")}
            </Typography>
        </>
    );
}
