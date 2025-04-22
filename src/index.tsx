import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "@mui/material";
import { AnimatePresence } from "framer-motion";
import { I18nextProvider, useTranslation } from "react-i18next";

import i18n from "./i18n.ts";
import { appTheme } from "./style.ts";
import { AppState, screenHeight, screenWidth, v4ScreenOffset } from "./xstate.ts";
import { LockScreen } from "./view/LockScreen.tsx";
import { ConfirmPosition } from "./view/ConfirmPosition.tsx";
import { ConfigRecipient } from "./view/delivery/ConfigRecipient.tsx";
import { Delivering } from "./view/delivery/Delivering.tsx";
import { ReturnHome } from "./view/ReturnHome.tsx";
import { CollectItems } from "./view/delivery/CollectItems.tsx";
import { Idle } from "./view/Idle.tsx";
import { Charging } from "./view/Charging.tsx";
import { ItemPlacing } from "./view/delivery/ItemPlacing.tsx";
import { Loading } from "./view/Loading.tsx";
import { WaitForRecipient } from "./view/delivery/WaitForRecipient.tsx";
import { ConfirmDetails } from "./view/delivery/ConfirmDetails.tsx";
import { Caution } from "./view/Caution.tsx";
import { FatalError } from "./view/FatalError.tsx";
import { IntegrationTest } from "./view/integrationTest/IntegrationTest.tsx";
import { Disinfection } from "./view/disinfection/Disinfection.tsx";
import { MotionWrapper } from "./components/MotionWrapper.tsx";
import { CloseLid } from "./view/disinfection/CloseLid.tsx";
import { GetItem } from "./view/GetItem.tsx";
import { Refill } from "./view/disinfection/Refill.tsx";
import { Navigate } from "./view/Navigate.tsx";


/// NOTE: these keys control which state chanegs will trigger
/// component unmount and which ones doesn't.
/// e.g. the "integrationTest" key ensures that all sub-states (e.g. "integrationTest.init")
/// will stay on the same component
const transitionStateKeys = [
    "init",
    "enterPasscode",
    "confirmPosition.init",
    "confirmPosition.overriding",
    "integrationTest",
    "idle",
    "getItem",
    "delivery.enterPasscodeInit",
    "delivery.placeItems.lidOpening",
    "delivery.collectItems.lidOpening",
    "delivery.placeItems.itemPlacing",
    "delivery.placeItems.lidClosing",
    "delivery.collectItems.lidClosing",
    "delivery.placeItems.cancelled",
    "delivery.configRecipient",
    "delivery.confirmDetails",
    "delivery.delivering",
    "delivery.waitForRecipient",
    "delivery.enterPasscodeCollect",
    "delivery.collectItems.itemCollection",
    "disinfection",
    "refill.enterPasscode",
    "refill.lidOpening",
    "refill.lidClosing",
    "refill.refilling",
    "openLid.lidOpening",
    "openLid.lidClosing",
    "openLid.refilling",
    "demo.lidClosing",
    "demo.closing",
    "returnHome",
    "charging.docking",
    "charging.docked",
    "charging.enterPasscode",
    "fatalError",
    "movingNavi.navigate",
    "movingNavi.waitForRecipient",
    "movingNavi.enterPasscodeCollect",
    "movingNavi.collectItems.itemCollection",

]

const defaultPasscode = "2357";

function App() {
    const { t } = useTranslation();
    const [state, send] = AppState.useActor();
    const isV4 = state.context.info?.robot.id.startsWith("u");
    const isRice = state.context.info?.robot.type === "rice";
    const isJasmine = state.context.info?.robot.type === "jasmine";

    return (
        <div
            style={{
                padding: isV4 ? v4ScreenOffset.map(x => `${x}px`).join(" ") : "unset",
                textAlign: "center",
                width: screenWidth,
                height: screenHeight,
                boxSizing: "border-box",
            }}
        >
            <div style={{ height: "100%", position: "relative", backgroundColor: "white" }}>
                <AnimatePresence>
                    {transitionStateKeys.map(key => state.matches(key) ?
                        <MotionWrapper key={key} page={key}>
                            {key === "init" && <Loading title={t("init")} />}
                            {key === "enterPasscode" &&
                                <LockScreen
                                    instructions={t("enterPasscode")}
                                    password={state.context.info.params.password ?? defaultPasscode}
                                    onSuccess={() => send("passcodeEntered")}
                                />
                            }
                            {key === "confirmPosition.init" && <ConfirmPosition />}
                            {key === "confirmPosition.overriding" &&
                                <Loading title={t("confirmPosition.overriding")} />
                            }
                            {key === "integrationTest" && <IntegrationTest />}
                            {key === "idle.missionCheck" && <Loading title={""} />}
                            {key === "idle" && isRice && <Idle.Delivery />}
                            {key === "delivery.enterPasscodeInit" &&
                                <LockScreen
                                    instructions={t("delivery.enterPasscodeInit")}
                                    password={state.context.info.params.password ?? defaultPasscode}
                                    onSuccess={() => send("passcodeEntered")}
                                    onBack={() => send("back")}
                                />
                            }
                            {(key === "delivery.placeItems.lidOpening" || key === "delivery.collectItems.lidOpening" || key === "refill.lidOpening" || key === "openLid.lidOpening") &&
                                <Caution title={t("delivery.placeItems.lidOpen")}
                                    subtitle={t("delivery.placeItems.keepClear")} />
                            }
                            {key === "delivery.placeItems.itemPlacing" && <ItemPlacing />}
                            {(key === "delivery.placeItems.lidClosing" || key === "delivery.collectItems.lidClosing" || key === "delivery.placeItems.cancelled" || key === "refill.lidClosing" || key === "demo.lidClosing" || key === "openLid.lidClosing") &&
                                <Caution title={t("delivery.placeItems.lidClose")}
                                    subtitle={t("delivery.placeItems.keepClear")} />
                            }
                            {key === "delivery.waitForRecipient" && <WaitForRecipient />}
                            {key === "delivery.enterPasscodeCollect" && (
                                <LockScreen
                                    instructions={t("delivery.enterPasscodeCollect")}
                                    //password={state.context.debugMode ? defaultPasscode : state.context.delivPassword}
                                    password={state.context.debugMode ? state.context.delivPassword : state.context.delivPassword}
                                    onSuccess={() => send("passcodeEntered")}
                                    onBack={() => send("back")}
                                />
                            )}
                            {key === "delivery.collectItems.itemCollection" && <CollectItems />}
                            {key === "refill.refilling" && <Refill />}
                            {key === "openLid.refilling" && <CloseLid />}
                            {key === "getItem" && <GetItem.Delivery />}
                            {key === "demo.closing" && <CloseLid />}
                            {key === "returnHome" && <ReturnHome />}
                            {key === "charging.docking" && <Charging.Docking />}
                            {key === "charging.docked" && isRice && <Charging.Delivery />}
                            {key === "charging.docked" && isJasmine && <Charging.Disinfection />}
                            {key === "fatalError" && <FatalError />}
                            {key === "movingNavi.navigate" && <Navigate.Chat />}
                        </MotionWrapper> : null
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
    <StrictMode>
        <ThemeProvider theme={appTheme}>
            <I18nextProvider i18n={i18n}>
                <AppState.Provider>
                    <App />
                </AppState.Provider>
            </I18nextProvider>
        </ThemeProvider>
    </StrictMode>
);