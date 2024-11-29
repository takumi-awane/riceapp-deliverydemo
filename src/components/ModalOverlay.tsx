import { ReactElement } from "react";
import  { Close } from '@mui/icons-material';
import { Modal } from "@mui/material";

import { AppState, v4ScreenOffset } from "../xstate.ts";
import { Palette } from "../style.ts";

export function ModalOverlay({ isOpen, onClose, children }: {
    isOpen: boolean;
    onClose?: () => void;
    children: ReactElement;
}) {
    const [ state, send ] = AppState.useActor();
    const isV4 = state.context.info.robot.id.startsWith("u");

    return (
        <Modal
            style={{
                backgroundColor: "rgba(255, 255, 255, 0.5)",
                backdropFilter: "blur(20px)",
                top: isV4 ? v4ScreenOffset[0] : 0,
                right: isV4 ? v4ScreenOffset[1] : 0,
                bottom: isV4 ? v4ScreenOffset[2] : 0,
                left: isV4 ? v4ScreenOffset[3] : 0
            }}
            hideBackdrop={true}
            open={isOpen}
        >
            <>
                {onClose ? <Close style={{ position: "absolute", top: 20, left: 20, fontSize: 40, color: Palette.darkGrey }} onClick={() => onClose()} /> : null}
                {children}
            </>
        </Modal >
    );
}