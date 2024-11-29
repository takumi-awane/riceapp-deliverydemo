import { useMemo, useState } from "react";
import { LocationOn } from "@mui/icons-material";
import { Typography } from "@mui/material";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { Button } from "../components/Button.tsx";
import { Palette } from "../style.ts";
import { StatusBar } from "./StatusBar.tsx";
import { OptionButton } from "../components/OptionButton.tsx";
import { AppState } from "../xstate.ts";
import { Point } from "../xstate.ts";

export function ConfirmPosition() {
    const { t } = useTranslation();
    const tr = (k) => t("confirmPosition." + k);
    const [state, send] = AppState.useActor();
    const [homePointId, setHomePointId] = useState<string>();
    const points = state.context.info?.site?.map?.points;

    const homePointOptions = useMemo(() => {
        const option: {[id: string]: Point} = {};
        for (const id in points) {
            if (points[id].waypoint?.home) {
                option[id] = points[id];
            }
        }
        return option;
    }, [points]);

    return (
        <>
            <StatusBar />
            <div style={{ height: 10 }} />
            <motion.div animate={{ y: [5, -5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}>
                <LocationOn style={{ fontSize: 180, color: Palette.cyan }} />
            </motion.div>
            <div style={{ height: 20 }} />
            <Typography variant="h4" fontWeight="bold">
                {tr("selectLoc")}
            </Typography>
            <div style={{ height: 25 }} />
            <div style={{ display: "flex", gap: 20, justifyContent: "center", width: "95%", overflow: "auto", margin: "auto" }}>
                {Object.keys(homePointOptions).length > 0 ? Object.entries(homePointOptions).map(([id, point]) => (
                    <OptionButton
                        key={id}
                        onClick={() => setHomePointId(id)}
                        color={Palette.orange}
                        isSelected={homePointId === id}
                    >
                        <Typography fontSize={20} whiteSpace="nowrap">{point.name}</Typography>
                    </OptionButton>
                )) :
                    <Typography fontSize={20} color={Palette.grey}>
                        {tr("noHome")}
                    </Typography>
                }
            </div>
            <div style={{ height: 50 }} />
            <Button disabled={!homePointId} onClick={() => send({type: "initPosConfirmed", homePoint: homePointId, chargerPoint: homePointId})} color={Palette.green} style={{ width: "30%", margin: "auto" }}>
                <Typography variant="h4" fontWeight="bold">
                    {tr("continue")}
                </Typography>
            </Button>
        </>
    );
}
