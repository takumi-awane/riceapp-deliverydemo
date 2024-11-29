import { AccessTime } from "@mui/icons-material";
import { Typography } from "@mui/material";
import { Duration } from "luxon";

import { Palette } from '../style.ts';

export function Timer({ seconds }: { seconds: number }) {
    return (
        <div style={{ padding: "5px 15px", border: `1px solid ${Palette.orange}`, borderRadius: 50, width: "fit-content", margin: "auto", display: "flex", alignItems: "center" }}>
            <AccessTime style={{ color: Palette.orange }} />
            <Typography fontSize={20} style={{ minWidth: 60, color: Palette.orange }}>
                {Duration.fromDurationLike({ seconds }).toFormat("mm:ss")}
            </Typography>
        </div>
    );
}