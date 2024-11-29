import { Typography } from "@mui/material";
import { Error } from '@mui/icons-material/';
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalOverlay } from "./ModalOverlay.tsx";
import { Button } from "./Button.tsx";
import { Palette } from "../style.ts";

export function SkippedDisinfection({ pathId, repetition, clear }: {
    pathId: string;
    repetition: number;
    clear: () => void;
}) {
    const { t } = useTranslation();
    const tr = (k) => t("charging.skippedDisinfection." + k);
    const [isShowDetail, setIsShowDetail] = useState(false);

    function clickHandle() {
        clear();
        setIsShowDetail(false);
    }

    return (
        <>
            <div
                onClick={() => setIsShowDetail(true)}
                style={{
                    padding: "5px 15px",
                    border: `1px solid ${Palette.red}`,
                    color: Palette.red,
                    borderRadius: 50,
                    width: "fit-content",
                    margin: "auto",
                    display: "flex",
                    alignItems: "center"
                }}
            >
                <Error />
                <Typography fontSize={20} style={{ padding: "0px 10px" }}>
                    {tr("skippedDisinfection")}
                </Typography>
            </div>
            <ModalOverlay isOpen={isShowDetail} >
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", textAlign: "center", width: "100%", height: "100%" }}>
                    <div>
                        <Typography variant="h3" fontWeight="bold">{tr("skippedDisinfection")}</Typography>
                        <div style={{ height: 10 }} />
                        <Typography variant="h5">{tr("insufficient")}</Typography>
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15 }}>
                            <Typography variant="overline" fontSize={35} color={Palette.darkGrey}>
                                {tr("pathId")}: {pathId}
                            </Typography>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15 }}>
                            <Typography variant="overline"  fontSize={35} color={Palette.darkGrey}>
                                {tr("rep")}: {repetition}
                            </Typography>
                        </div>
                    </div>
                    <Button onClick={clickHandle} color={Palette.red} style={{ width: "30%" }} requiresAnimationDelay={true}>
                        <Typography variant="h4" fontWeight="bold">
                            {tr("clear")}
                        </Typography>
                    </Button>
                </div>
            </ModalOverlay>
        </>
    );
}