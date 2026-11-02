"use client";

import { answerFoldScene } from "./answer-fold";
import { heroFanOutScene } from "./hero-fan-out";
import { reportGridScene } from "./report-grid";
import { SceneStage } from "./scene-stage";

type StageProps = {
	label: string;
	caption: string;
	stageClassName?: string;
};

/**
 * Server sections render these wrappers so the scene modules — and their
 * layout/build functions — never cross the server/client boundary.
 */
export function HeroStage(props: StageProps) {
	return <SceneStage scene={heroFanOutScene} {...props} />;
}

export function AnswerStage(props: StageProps) {
	return <SceneStage scene={answerFoldScene} {...props} />;
}

export function ReportGridStage(props: StageProps) {
	return <SceneStage scene={reportGridScene} {...props} />;
}
