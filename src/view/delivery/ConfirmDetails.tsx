import { Phone, Room } from "@mui/icons-material";
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import { AppState } from "../../xstate.ts";
import { Palette } from "../../style.ts";
import { Button } from "../../components/Button.tsx";
import { StatusBar } from "../StatusBar.tsx";
import { Timer } from "../../components/Timer.tsx";

export function ConfirmDetails() {
    const { t } = useTranslation();
    const tr = (k) => t("delivery.confirmDetails." + k);
    const [state, send] = AppState.useActor();
    const recipientPhone = state.context.mission.meta.phoneNumber;
    const destinationId = state.context.mission.meta.to;
    const destinationName = state.context.info.site.map.points[destinationId].name;
    const timeRemaining = state.context.tickRemain;

    return (
        <>
            <StatusBar central={<Timer seconds={timeRemaining} />} />
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-evenly", alignItems: "center", textAlign: "center", width: "100%", height: "80%" }}>
                <div>
                    <Typography variant="h3" fontWeight="bold">
                        {tr("title")}
                    </Typography>
                    <div style={{ height: 10 }} />
                    <Typography variant="h5">
                        {tr("subtitle")}
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
                <Stack direction="row" justifyContent="center" alignItems="center" style={{ width: "100%" }} spacing={3}>
                    <Button onClick={() => send("back")} color={Palette.red} style={{ width: "30%" }} requiresAnimationDelay={true}>
                        <Typography variant="h4" fontWeight="bold">
                            {tr("back")}
                        </Typography>
                    </Button>
                    <Button onClick={() => send("detailsConfirmed")} color={Palette.green} style={{ width: "30%" }} requiresAnimationDelay={true}>
                        <Typography variant="h4" fontWeight="bold">
                            {tr("confirm")}
                        </Typography>
                    </Button>
                </Stack>
            </div>
        </>
    )
}
