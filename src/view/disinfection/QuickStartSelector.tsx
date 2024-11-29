import { Typography } from "@mui/material";
import { Button } from "../../components/Button.tsx";
import { Palette } from "../../style.ts";
import { AppState } from "../../xstate.ts";
import { useTranslation } from "react-i18next";

export function QuickStartSelector() {
    const { t } = useTranslation();
    const tr = (k, opt = {}) => t("idle.disinfection.quickStart." + k, opt);
    const [ state, send ] = AppState.useActor();
    const paths = state.context.info.site.map.paths;

    function startImmediately(pathId: string) {
        send({
            type: "quickStartDisinfection", 
            pathId: pathId
        });
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
            <div style={{ height: 20 }} />
            {state.matches("charging") && (
                <Button style={{ width: "30%" }} color={Palette.blue} onClick={()=>send("wake")} requiresUnlock={true}>
                    <Typography variant="h5" fontWeight="bold">{tr("wake")}</Typography>
                </Button>
            )}
            {state.matches("idle") && Object.entries(paths).map(([id, pathInfo]) => (
                <Button key={id} style={{ width: "30%", flexDirection: "column" }} color={Palette.orange} onClick={() => startImmediately(id)}>
                    <Typography variant="h6" display="block">{id}</Typography>
                    <Typography variant="button" display="block">{pathInfo.name || tr("noName")}</Typography>
                </Button>
            ))}
            <div style={{ height: 20 }} />
        </div>
    );
}