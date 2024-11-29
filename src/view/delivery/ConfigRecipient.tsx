import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Stack, Typography } from "@mui/material";
import { Phone, Room }  from "@mui/icons-material";
import { CountryCode, isValidPhoneNumber, parsePhoneNumber } from "libphonenumber-js";
import { getCountryForTimezone } from "countries-and-timezones";
import { useTranslation } from "react-i18next";

import { StatusBar } from "../StatusBar.tsx";
import { NumberPad } from "../../components/NumberPad.tsx";
import { Palette } from "../../style.ts";
import { Button } from "../../components/Button.tsx";
import { OptionButton } from "../../components/OptionButton.tsx";
import { AppState } from "../../xstate.ts";
import { Timer } from "../../components/Timer.tsx";
import { SoundEffect, playSoundEffect } from "../../helper/sfx.ts";

function timezoneToCountry(tzName: string): CountryCode {
    return getCountryForTimezone(tzName).id as CountryCode;
}

export function ConfigRecipient() {
    const { t } = useTranslation();
    const tr = (k) => t("delivery.configRecipient." + k);
    const [state, send] = AppState.useActor()
    const [phone, setPhone] = useState("");
    const [destination, setDestination] = useState<string>();
    const [focus, setFocus] = useState<"phone" | "destination">("phone");
    const { timezone } = state.context.info.robot;
    const { points } = state.context.info.site.map;
    const timeRemaining = state.context.tickRemain;
    const { homePoint } = state.context;

    const isPhoneValid = useMemo(() => {
        return isValidPhoneNumber(phone, timezoneToCountry(timezone));
    }, [phone, timezone]);

    const destinationOptions = useMemo(() => {
        return Object.entries(points)
            .filter(([pointId, pointInfo]) => pointInfo.waypoint?.delivery?.destination && pointInfo.name)
            .map(([pointId, pointInfo]) => {
                return { ...pointInfo, id: pointId };
            });
    }, [points]);

    function toConfirm() {
        const phoneNumber = parsePhoneNumber(phone, timezoneToCountry(timezone));
        send({type: "recipientConfigured", meta: {from: homePoint, to: destination, phoneNumber: phoneNumber.number}})
    }

    async function detailsClick(detail: typeof focus) {
        await playSoundEffect(SoundEffect.input);
        setFocus(detail)
    }

    return (
        <>
            <StatusBar central={<Timer seconds={timeRemaining} />} />
            <div style={{ width: "100%", display: "flex", height: 370 }}>
                {/* Input items selector */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        textAlign: "start",
                        width: "50%",
                    }}
                >
                    <motion.div
                        whileTap={{ scale: 0.8 }}
                        style={{
                            border: focus === "phone" ? `2px solid ${isPhoneValid ? Palette.green : Palette.red}` : "2px solid white",
                            borderRadius: 30,
                            padding: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 15,
                            minWidth: 350
                        }}
                        onClick={() => detailsClick("phone")
                    }>
                        <Phone style={{ fontSize: 50, color: isPhoneValid ? Palette.green : Palette.pink }} />
                        <div>
                            <Typography variant="h6" fontWeight="bold" color={Palette.darkGrey}>
                                {tr("recipient")}
                            </Typography>
                            <Typography variant="h4" color={phone ? Palette.black : Palette.grey}>
                                {phone || tr("phone")}
                            </Typography>
                        </div>
                    </motion.div>
                    <div style={{ height: 40 }} />
                    <motion.div whileTap={{ scale: 0.8 }} style={{ border: focus === "destination" ? `2px solid ${destination ? Palette.green : Palette.red}` : "2px solid white", borderRadius: 30, padding: 10, display: "flex", alignItems: "center", gap: 15, minWidth: 350 }} onClick={() => detailsClick("destination")}>
                        <Room style={{ fontSize: 50, color: destination ? Palette.green : Palette.pink }} />
                        <div>
                            <Typography variant="h6" fontWeight="bold" color={Palette.darkGrey}>
                                {tr("dest")}
                            </Typography>
                            <Typography variant="h4" color={destination ? Palette.black : Palette.grey}>
                                {destination ? points[destination].name : tr("selectDest")}
                            </Typography>
                        </div>
                    </motion.div>
                </div>
                {/* Divider */}
                <div style={{ height: "80%", margin: "auto", width: 1, backgroundColor: Palette.grey }} />
                {/* Input instrument */}
                <div
                    style={{
                        width: "50%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        overflowX: "hidden",
                        overflowY: "auto"
                    }}
                >
                    {focus === "phone" ? (
                        <div style={{ width: 350 }}>
                            <NumberPad number={phone} onChange={setPhone} specialCharacter="+" />
                        </div>
                    ) : null}
                    {focus === "destination" ? destinationOptions.map(x => (
                        <OptionButton key={x.id} style={{ width: "50%", margin: "7px 0px" }} onClick={() => setDestination(x.id)} color={Palette.orange} isSelected={destination === x.id}>
                            <Typography style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {x.name ?? x.id}
                            </Typography>
                        </OptionButton>
                    )) : null}
                    {focus === "destination" && destinationOptions.length === 0 ? (
                        <Typography>
                            {tr("noDest")}
                        </Typography>
                    ) : null}
                </div>
            </div>
            <div style={{ height: 20 }} />
            {/* Bottom button */}
            <Stack direction="row" justifyContent="center" alignItems="center" style={{ width: "100%" }} spacing={3}>
                <Button onClick={() => send("back")} style={{ width: "20%" }} color={Palette.darkGrey}>
                    <Typography variant="h4" fontWeight="bold">
                        {tr("back")}
                    </Typography>
                </Button>
                <Button onClick={() => toConfirm()} style={{ width: "20%" }} color={Palette.green} disabled={!isPhoneValid || !destination}>
                    <Typography variant="h4" fontWeight="bold">
                        {tr("continue")}
                    </Typography>
                </Button>
            </Stack>
        </>
    );
}