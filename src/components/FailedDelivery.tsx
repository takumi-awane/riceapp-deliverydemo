import { Typography } from "@mui/material";
import { Error, Phone, Room } from '@mui/icons-material/';
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalOverlay } from "./ModalOverlay.tsx";
import { Button } from "./Button.tsx";
import { AppState } from "../xstate.ts";
import { Palette } from "../style.ts";

export function FailedDelivery({ recipientPhone, destinationId, clear }: {
    recipientPhone: string;
    destinationId: string;
    clear: () => void;
}) {
    const { t } = useTranslation();
    const tr = (k) => t("idle.failedDelivery." + k);
    const [state] = AppState.useActor();
    const [isShowDetail, setIsShowDetail] = useState(false);
    const destinationName = state.context.info.site.map.points[destinationId].name;

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
                    {tr("deliveryFailed")}
                </Typography>
            </div>
            <ModalOverlay isOpen={isShowDetail} >
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", textAlign: "center", width: "100%", height: "100%" }}>
                    <div>
                        <Typography variant="h3" fontWeight="bold">
                            {tr("deliveryFailed")}
                        </Typography>
                        <div style={{ height: 10 }} />
                        <Typography variant="h5">
                            {tr("itemNotCollected")}
                        </Typography>
                    </div>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15 }}>
                            <Phone style={{ fontSize: 40, color: Palette.orange }} />
                            <Typography variant="overline" lineHeight={0} fontSize={35} color={Palette.darkGrey}>
                                {recipientPhone}
                            </Typography>
                        </div>
                        <div style={{ height: 25 }} />
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 15 }}>
                            <Room style={{ fontSize: 40, color: Palette.orange }} />
                            <Typography variant="overline" lineHeight={0} fontSize={35} color={Palette.darkGrey}>
                                {destinationName ?? destinationId}
                            </Typography>
                        </div>
                    </div>
                    <Button onClick={clear} color={Palette.red} style={{ width: "30%" }} requiresAnimationDelay={true}>
                        <Typography variant="h4" fontWeight="bold">
                            {tr("clear")}
                        </Typography>
                    </Button>
                </div>
            </ModalOverlay>
        </>
    );
}