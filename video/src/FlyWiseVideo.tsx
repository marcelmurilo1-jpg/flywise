import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import { SCENE_DURATIONS, TRANSITION_FRAMES } from "./timing";
import { AberturaScene } from "./scenes/AberturaScene";
import { ProblemaScene } from "./scenes/ProblemaScene";
import { FeatureScene } from "./scenes/FeatureScene";
import { CTAScene } from "./scenes/CTAScene";

const t = () => (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
  />
);

export const FlyWiseVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#F7F9FC" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.abertura}>
          <AberturaScene />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.problema}>
          <ProblemaScene />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.busca}>
          <FeatureScene
            assetSrc="screenshots/busca.png"
            assetType="image"
            label="Disponibilidade real de assentos premium"
            sublabel="Powered by Seats.aero"
            totalFrames={SCENE_DURATIONS.busca}
          />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.estrategia}>
          <FeatureScene
            assetSrc="screenshots/estrategia.png"
            assetType="image"
            label="Plano passo a passo em segundos"
            sublabel="Claude analisa CPM, programas e transferências"
            totalFrames={SCENE_DURATIONS.estrategia}
          />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.transferencia}>
          <FeatureScene
            assetSrc="screenshots/transferencia.png"
            assetType="image"
            label="Saiba exatamente quando transferir"
            sublabel="Bônus de transferência em tempo real"
            totalFrames={SCENE_DURATIONS.transferencia}
          />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.paraonde}>
          <FeatureScene
            assetSrc="screenshots/paraonde.png"
            assetType="image"
            label="Todos os destinos com suas milhas"
            sublabel="Smiles, LATAM Pass, TudoAzul comparados"
            totalFrames={SCENE_DURATIONS.paraonde}
          />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.roteiro}>
          <FeatureScene
            assetSrc="screenshots/roteiro.png"
            assetType="image"
            label="Roteiro completo, dia a dia"
            sublabel="Do voo ao hotel — tudo em um lugar"
            totalFrames={SCENE_DURATIONS.roteiro}
          />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.promocoes}>
          <FeatureScene
            assetSrc="screenshots/promocoes.png"
            assetType="image"
            label="Alertas em tempo real enquanto você dorme"
            sublabel="Nunca perca um bônus de transferência"
            totalFrames={SCENE_DURATIONS.promocoes}
          />
        </TransitionSeries.Sequence>

        {t()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.cta}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
