import { Typography } from '@mui/material';
import { motion } from "framer-motion";

import { Palette } from '../style.ts';


export function Recording() {
    return (
        <div style={{ padding: "5px 15px", border: `1px solid ${Palette.red}`, borderRadius: 50, width: "fit-content", margin: "auto", display: "flex", alignItems: "center" }}>
            <motion.div
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 5, repeat: Infinity }}
                style={{ borderRadius: 50, width: 20, height: 20, backgroundColor: Palette.red }}
            />
            <div style={{ width: 10 }} />
            <Typography fontSize={20} style={{ color: Palette.red }}>
                Recording
            </Typography>
        </div>
    );
}