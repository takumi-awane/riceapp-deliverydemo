import { Stack, Typography } from "@mui/material";
import { ReactElement, useState } from "react";
import { PestControl, Construction, Inventory, Close, Settings, Animation } from '@mui/icons-material';

import { Palette } from "../style.ts";
import { Battery } from "../components/Battery.tsx";
import { Button } from "../components/Button.tsx";
import { ModalOverlay } from "../components/ModalOverlay.tsx";
import { AppState } from "../xstate.ts";

const cellStyle = { border: "none", width: "50%", padding: 5 };

export function StatusBar({ theme = "dark", central, disableExpansion = false }: {
    theme?: "light" | "dark";
    central?: ReactElement;
    disableExpansion?: boolean;
}) {
    const [state, send] = AppState.useActor();
    const [showMoreStatus, setShowMoreStatus] = useState(false);

    const displayInfo = [
        { key: "ID", value: state.context.info.robot.id || "-", isAvailable: true },
        { key: "Name", value: state.context.info.robot.name || "-", isAvailable: true },
        { key: "Rice OS", value: state.context.info.robot.riceOs || "-", isAvailable: true },
        { key: "Type", value: state.context.info.robot.type || "-", isAvailable: true },
        { key: "Debug mode", value: state.context.info.robot.debugMode ? "yes" : "no", isAvailable: true },
        { key: "Site", value: state.context.info.site.id || "-", isAvailable: true },
        { key: "Locale", value: state.context.info.site.locale || "-", isAvailable: true },
        { key: "Online", value: state.context.status?.online ? "yes" : "no", isAvailable: true },
        { key: "Navigation", value: state.context.status?.navigationState || "-", isAvailable: true },
        { key: "Fluid level", value: `${state.context.status?.fluidLevel.value || "-"}%`, isAvailable: state.context.info.robot.type === "jasmine" }
    ];

    const displayAction: { key: string; isAvailable: boolean, icon: JSX.Element, color: Palette; onClick: () => void; }[] = [
        {
            key: "Settings",
            isAvailable: true,
            icon: (<Settings style={{ fontSize: 40 }} />),
            color: Palette.pink,
            onClick: () => { window.location.href = import.meta.env.VITE_SPLASH_SCREEN_URL!; }
        },
        {
            key: `${state.context.status.lid === "close" || state.context.status.lid === "closing" ? "Open" : "Close"} Lid`,
            isAvailable: state.context.debugMode || state.context.devMode,
            icon: (<Inventory style={{ fontSize: 40 }} />),
            color: Palette.orange,
            onClick: () => send("lidFire")
        },
        {
            key: `${state.context.status.eBrake === "freewheel" ? "Engage" : "Release"} eBrake`,
            isAvailable: state.context.debugMode || state.context.devMode,
            icon: (<Animation style={{ fontSize: 40 }} />),
            color: Palette.yellow,
            onClick: () => send("eBrakeFire")
        },
        {
            key: "Close",
            isAvailable: true,
            icon: (<Close style={{ fontSize: 40 }} />),
            color: Palette.blue,
            onClick: () => setShowMoreStatus(false)
        },
    ];

    return (
        <>
            {/* Extra info display */}
            <ModalOverlay isOpen={showMoreStatus} onClose={() => setShowMoreStatus(false)}>
                <div style={{ height: "100%", width: "100%", textAlign: "center", display: "flex", justifyContent: "space-evenly", alignItems: "center" }}>
                    <table style={{ borderCollapse: "collapse" }}>
                        <tbody>
                            {displayAction.map(x => x.isAvailable ? (
                                <tr key={x.key}>
                                    <td style={cellStyle}>
                                        <div style={{ height: 10 }} />
                                        <Button style={{ width: "fit-content", margin: "auto" }} onClick={x.onClick} color={x.color}>{x.icon}</Button>
                                        <div style={{ height: 10 }} />
                                        <Typography variant="button" fontSize={15} color={Palette.darkGrey}>{x.key}</Typography>
                                        <div style={{ height: 10 }} />
                                    </td>
                                </tr>
                            ) : null)}
                        </tbody>
                    </table>
                    <div style={{ height: "80%", width: 1, backgroundColor: "grey" }} />
                    <table style={{ borderCollapse: "collapse", textAlign: "start", width: "50%" }}>
                        <tbody>
                            {displayInfo.map(x => x.isAvailable ? (
                                <tr key={x.key}>
                                    <td style={cellStyle}><Typography fontSize={20} fontWeight="bold" >{x.key}</Typography></td>
                                    <td style={cellStyle}><Typography fontSize={20}>{x.value}</Typography></td>
                                </tr>
                            ) : null)}
                        </tbody>
                    </table>
                </div>
            </ModalOverlay>

            {/* Status bar */}
            <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                style={{ padding: 20, color: theme === "light" ? Palette.white : Palette.darkGrey }}
            >
                <div style={{ width: 150, textAlign: "start" }}>
                    <img
                        src={theme === "light" ? "./riceLogoWhite.svg" : "./riceLogoBlack.svg"}
                        height={35}
                        onClick={() => disableExpansion ? null : setShowMoreStatus(true)}
                    />
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {central}
                </div>
                <Stack
                    direction="row"
                    justifyContent="end"
                    alignItems="center"
                    spacing={1}
                    style={{ width: 150 }}
                >
                    <Typography variant="h6">{Math.floor(state.context.status.charge)}%</Typography>
                    <Battery
                        height={15}
                        width={40}
                        percentage={state.context.status.charge}
                        isCharging={state.context.status.charging}
                        theme={theme}
                    />
                </Stack>
            </Stack>
        </>
    );
}