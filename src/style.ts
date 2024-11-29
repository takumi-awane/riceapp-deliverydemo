import "@fontsource/quicksand/300.css";
import "@fontsource/quicksand/400.css";
import "@fontsource/quicksand/500.css";
import "@fontsource/quicksand/700.css";
import "./style.css";

import { createTheme } from "@mui/material";

export enum Palette {
    red = "rgb(255, 59, 48)",
    orange = "rgb(255, 149, 0)",
    yellow = "rgb(255, 204, 0)",
    green = "rgb(52, 199, 89)",
    mint = "rgb(0, 199, 190)",
    teal = "rgb(48, 176, 199)",
    cyan = "rgb(50, 173, 230)",
    blue = "rgb(0, 122, 255)",
    indigo = "rgb(88, 86, 214)",
    purple = "rgb(175, 82, 222)",
    pink = "rgb(255, 45, 85)",
    brown = "rgb(162, 132, 94)",
    lightgrey = "rgb(180, 180, 180)",
    grey = "rgb(142, 142, 147)",
    darkGrey = "rgb(99, 99, 102)",
    black = "black",
    white = "white",
}

export const appTheme = createTheme({
	typography: {
        fontFamily: [
            "Quicksand",        // Shipped with app
            "Source Han Sans",  // Shipped with RiceOS
            "Noto Sans",        // Avaliable on many desktop systems (Google's Source Han Sans)
            "sans-serif"        // Fallback
        ].join(",")
    }
});