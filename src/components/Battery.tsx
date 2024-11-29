import { Bolt } from "@mui/icons-material";
import { Fade, Stack } from "@mui/material";

import { Palette } from "../style.ts";

export function Battery({ height, width, percentage, isCharging, theme }: {
    height: number;
    width: number;
    percentage: number;
    isCharging: boolean;
    theme: "light" | "dark";
}) {
    const batteryColor = theme === "light" ? Palette.white : Palette.darkGrey;

    function getBatteryLiquidColor() {
        if (isCharging) return Palette.green;
        else if (percentage < 10) return Palette.red;
        else if (theme === "light") return Palette.white;
        else return Palette.black;
    }

    return (
        <Stack
            direction="row"
            justifyContent="center"
            alignItems="center"
            spacing={0}
        >
            <div
                style={{
                    height,
                    width,
                    borderRadius: Math.max(7, width * 0.1),
                    border: `${Math.max(2, height * 0.1)}px ${batteryColor} solid`,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    overflow: "hidden",
                    padding: Math.max(2, height * 0.1),
                    position: "relative",
                }}
            >
                <div
                    style={{
                        backgroundColor: getBatteryLiquidColor(),
                        borderRadius: Math.max(4, height * 0.15),
                        height: "100%",
                        width: `${Math.floor(Math.max(percentage, 5))}%`,
                        transition: "width 1s",
                    }}
                />
                <Fade in={isCharging}>
                    <div
                        style={{
                            position: "absolute",
                            right: 0,
                            left: 0,
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                        }}
                    >
                        <Bolt
                            style={{
                                height: height,
                                width: height,
                                color: batteryColor,
                            }}
                        />
                    </div>
                </Fade>
            </div>
            <div
                style={{
                    height: height * 0.5,
                    width: width * 0.1,
                    backgroundColor: batteryColor,
                    borderRadius: `0px ${Math.max(3, height * 0.1)}px ${Math.max(3, height * 0.1)}px 0px`,
                }}
            />
        </Stack>
    );
}
