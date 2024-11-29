import { Typography } from "@mui/material";
import { StatusBar } from "../StatusBar.tsx";
import { DataObject, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material';
import { Palette } from "../../style.ts";
import React, { useState } from "react";
import { AppState } from "../../xstate.ts";
import { Button } from "../../components/Button.tsx";
import { OptionButton } from "../../components/OptionButton.tsx";
import { Recording } from "../../components/Recording.tsx";

export function IntegrationTest() {
    const [state, send] = AppState.useActor();
    const [enabledTest, setEnabledTest] = useState(new Set<number>());
    const [selectedPath, setSelectedPath] = useState<string>(null);
    const paths = state.context.info.site.map.paths;
    const recordVideo = state.context.status.recordVideo;
    const parkAttempts = state.context.parkAttempts;
    const parkSuccesses = state.context.parkSuccesses;

    const stageMap = [
        {
            id: 1,
            description: "Run through all waypoints",
        },
        {
            id: 2,
            description: "Park and charge",
        },
        {
            id: 3,
            description: "Open and close lid",
        }
    ];

    function enableTest(id: number) {
        if (!state.matches({ integrationTest: "init" })) {
            console.error("Test has already commenced");
            return;
        }
        const newEnabledTest = new Set(enabledTest);
        newEnabledTest.add(id);
        setEnabledTest(newEnabledTest);
    }

    function disableTest(id: number) {
        if (!state.matches({ integrationTest: "init" })) {
            console.error("Test has already commenced");
            return;
        }
        const newEnabledTest = new Set(enabledTest);
        newEnabledTest.delete(id);
        setEnabledTest(newEnabledTest);
    }

    return (
        <>
            <StatusBar central={recordVideo.front ? <Recording /> : undefined} />
            <div style={{ height: 10 }} />
            <DataObject style={{ color: Palette.purple, fontSize: 100 }} />
            <div style={{ height: 10 }} />
            <Typography variant="h3" fontWeight="bold">Integration Test</Typography>
            <div style={{ height: 30 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", width: "95%", overflow: "auto", margin: "auto" }}>
                {Object.keys(paths).length > 0 ? Object.entries(paths).map(([id, path]) => (
                    <OptionButton
                        key={id}
                        onClick={() => {
                            setSelectedPath(id);
                        }}
                        color={Palette.orange}
                        isSelected={selectedPath === id}
                        style={{ height: "fit-content", padding: "5px 10px" }}
                    >
                        <Typography fontSize={15} whiteSpace="nowrap">{path.name ?? id}</Typography>
                    </OptionButton>
                )) :
                    <Typography fontSize={15} color={Palette.grey}>No path found on map</Typography>
                }
            </div>
            <div style={{ height: 20 }} />
            {stageMap.map(({ id, description }) => (
                <React.Fragment key={id} >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "center" }}>
                        {enabledTest.has(id) ? (
                            <CheckCircle fontSize="small" style={{ color: Palette.green }} onClick={() => disableTest(id)} />
                        ) : (
                            <RadioButtonUnchecked style={{ color: Palette.grey }} fontSize="small" onClick={() => enableTest(id)} />
                        )}
                        <Typography display="inline">{description}</Typography>
                        {id === 2 && !state.matches("integrationTest.init") ?
                            <Typography>(attempts: {parkAttempts}, successes: {parkSuccesses})</Typography> :
                            null
                        }
                    </div>
                    <div style={{ height: 10 }} />
                </React.Fragment>
            ))}
            <div style={{ height: 20 }} />
            <Button
                onClick={() => send({ type: "beginTest", pathId: selectedPath, tests: enabledTest })}
                color={Palette.blue}
                disabled={!state.matches({ integrationTest: "init" }) || enabledTest.size === 0 || !selectedPath}
                style={{ margin: "auto", width: "25%" }}
            >
                <Typography variant="h4" fontWeight="bold">Start</Typography>
            </Button>
        </>
    );
}