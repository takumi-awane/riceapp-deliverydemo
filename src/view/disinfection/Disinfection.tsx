import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PlayArrow, Pause } from '@mui/icons-material';
import { Typography } from '@mui/material';
import { useTranslation } from "react-i18next";

import { StatusBar } from '../StatusBar.tsx';
import { AppState, screenHeight, screenWidth } from '../../xstate.ts';
import { roundToDecimalPlaces } from '../../util.ts';
import { Palette } from '../../style.ts';
import "./mapStyle.css";

const zoom = 3;
const myLocationComponentRadius = 25;
const countDownCircle = {
	radius: 28,
	width: 3
};

export function Disinfection() {
	const { t } = useTranslation();
    const tr = (k, opt = {}) => t("disinfection." + k, opt);
    const [state, send] = AppState.useActor();
    const mapCanvas = useRef<any>();
    const mapCanvasContainer = useRef<any>();
    const imageHeightRef = useRef(0);
    const innateScaleFactorRef = useRef(0);
    const x = roundToDecimalPlaces(state.context.status.position.x ?? 0, 1);
	const y = roundToDecimalPlaces(state.context.status.position.y ?? 0, 1);
    const myLocation = {
		top: (imageHeightRef.current - y * innateScaleFactorRef.current) * zoom - myLocationComponentRadius,
		left: x * innateScaleFactorRef.current * zoom - myLocationComponentRadius,
	};
	const mapImage = state.context.mapImage;
	const mapWidth = state.context.info.site.map.width;
	const repetition = state.context.mission.meta.repetition;
	const points = state.context.info.site.map.points;

    useEffect(() => {
        generateMap();
    }, [mapImage]);

    function onPauseResumeButtonClick() {
        if (state.matches("disinfection.performing.paused")) {
            send("resume");
        } else {
            send("pause");
        }
	}

    function generateRobotProgress() {
		if (state.matches("disinfection.start")) {
			return <Typography variant="h4">{tr("start")}</Typography>;
		} else if (state.matches("disinfection.performing")) {
			return (
				<>
					<Typography variant="h4">
						{repetition < Infinity ? tr("remain", { repetition }) : tr("infinite")}
					</Typography>
					{/* <Typography variant="h4">Progress {Math.round((checkpointCount.current / checkpointCount.total) * 100)}%</Typography> */}
				</>
			);
		} else if (state.matches("disinfection.end")) {
			return <Typography variant="h4">{tr("end")}</Typography>;
		}
	}

    async function generateMap() {
        if (!mapImage) return;

		const imageBitmap = await createImageBitmap(mapImage); // for obtaining size and drawing to canvas
		imageHeightRef.current = imageBitmap.height;
		innateScaleFactorRef.current = Math.round(imageBitmap.width / mapWidth); // map actual size (in meters) is likely smaller than imageBitMap (in pixels)

		const canvas = mapCanvas.current as HTMLCanvasElement;
		canvas.width = imageBitmap.width * zoom;
		canvas.height = imageBitmap.height * zoom;
		const ctx = canvas.getContext("2d")!;

		// draw map first, so points can overlay
		ctx.drawImage(imageBitmap, 0, 0, imageBitmap.width * zoom, imageBitmap.height * zoom);

		for (const id in points) {
			ctx.beginPath();
			ctx.arc(
				points[id].coord[0] * innateScaleFactorRef.current * zoom,
				(imageBitmap.height - points[id].coord[1] * innateScaleFactorRef.current) * zoom, 5, 0, 2 * Math.PI
			);
			ctx.fillStyle = Palette.cyan;
			ctx.fill();
		}
	}

    function scrollToPoint(top: number, left: number) {
		if (mapCanvasContainer.current) {
			mapCanvasContainer.current.scroll({ top, left });
		}
	}

    scrollToPoint(
		myLocation.top - screenHeight / 3,
		myLocation.left - screenWidth / 2
	);

    return (
        <>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 }}>
				<StatusBar disableExpansion={true} />
			</div>

            <div
				ref={mapCanvasContainer}
				style={{
					background: "linear-gradient(0deg, #5e6d7c 0%, #7b9bbb 100%)",
					height: "100%",
					width: "100%",
					position: "relative",
					overflow: "hidden",
				}}
			>
                {/* map */}
				<canvas ref={mapCanvas} />

                {/* robot position */}
				<div style={{ position: "absolute", top: myLocation.top, left: myLocation.left }}>
					<div className="ring-container">
						<div className="ringring" />
						<div className="circle" />
					</div>
				</div>
            </div>

            {/* Navigation bar */}
			<div
				style={{
					position: "absolute",
					bottom: 20,
					left: 20,
					right: 20,
					padding: "19px 20px",
					borderRadius: 50,
					backgroundColor: "rgba(0, 0, 0, 0.5)",
					backdropFilter: "blur(20px)",
					color: Palette.white,
				}}
			>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }} >
                    <div style={{ position: "relative", lineHeight: 0 }}>
                        <svg width={(countDownCircle.radius + countDownCircle.width) * 2} height={(countDownCircle.radius + countDownCircle.width) * 2} transform="rotate(270)" >
							<circle
								// strokeDasharray={`${2 * Math.PI * countDownCircle.radius * pauseCountdown / pauseCountdownRef.current.total} ${2 * Math.PI * countDownCircle.radius * 2}`}
								cx={countDownCircle.radius + countDownCircle.width}
								cy={countDownCircle.radius + countDownCircle.width}
								r={countDownCircle.radius}
								stroke={Palette.white}
								strokeWidth={countDownCircle.width}
								fill="none"
								style={{ transition: "stroke-dasharray 1s ease-in-out" }}
							/>
						</svg>
                        <motion.div
							onClick={onPauseResumeButtonClick}
							style={{
								height: 2 * countDownCircle.radius,
								width: 2 * countDownCircle.radius,
								backgroundColor: state.matches("disinfection.performing.paused") ? Palette.green : Palette.orange,
								borderRadius: 50,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								position: "absolute",
								top: countDownCircle.width,
								bottom: countDownCircle.width,
								right: countDownCircle.width,
								left: countDownCircle.width
							}}
						>
                            {state.matches("disinfection.performing.paused") ? <PlayArrow fontSize="large" /> : <Pause fontSize="large" />}
                        </motion.div>
                    </div>
                    {generateRobotProgress()}
                </div>
            </div>
        </>
    )
}
