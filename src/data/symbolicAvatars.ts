export interface SymbolicAvatar {
  id: string;
  name: string;
  description: string;
  emotionalState: string;
  imagePath: string;
}

export const SYMBOLIC_AVATARS: SymbolicAvatar[] = [
  {
    id: "seed-in-dark",
    name: "A Semente no Escuro",
    description: "Uma pequena semente a brilhar timidamente debaixo da terra",
    emotionalState: "Para quem se sente 'enterrado' pelos problemas, mas sabe que tem um potencial imenso adormecido à espera de brotar. Representa a esperança contida e o início da jornada.",
    imagePath: "/avatars/seed-in-dark.webp"
  },
  {
    id: "kintsugi-vase",
    name: "O Vaso Kintsugi",
    description: "Um vaso de cerâmica que foi partido, mas reparado com linhas douradas",
    emotionalState: "Para quem está a começar a aceitar que as suas 'quebras' e traumas fazem parte da sua história e que podem ser transformados em algo valioso e belo. Representa a cura e a resiliência.",
    imagePath: "/avatars/kintsugi-vase.webp"
  },
  {
    id: "deep-diver",
    name: "O Mergulhador nas Profundezas",
    description: "Uma silhueta de alguém a mergulhar num oceano azul profundo com uma pequena luz",
    emotionalState: "Para o utilizador corajoso que está pronto para encarar os seus medos subconscientes. Representa a introspeção profunda e a coragem de explorar o desconhecido dentro de si.",
    imagePath: "/avatars/deep-diver.webp"
  },
  {
    id: "lit-labyrinth",
    name: "O Labirinto com uma Saída Iluminada",
    description: "Uma vista aérea de um labirinto complexo, mas com uma luz brilhante a indicar o caminho",
    emotionalState: "Para quem se sente perdido e confuso no meio das mentiras em que acreditou, mas está ativamente à procura da verdade e do caminho para a clareza.",
    imagePath: "/avatars/lit-labyrinth.webp"
  },
  {
    id: "flame-in-storm",
    name: "A Pequena Chama na Tempestade",
    description: "Uma vela ou uma pequena fogueira a arder, protegida por mãos, no meio de um cenário de vento e chuva",
    emotionalState: "Para quem está a passar por um momento muito difícil, mas mantém uma 'chama interior' de força e vontade de viver que não se apaga. Representa resistência e fé.",
    imagePath: "/avatars/flame-in-storm.webp"
  },
  {
    id: "breaking-cocoon",
    name: "O Casulo a Romper",
    description: "A imagem de um casulo com uma pequena racha por onde começa a sair uma luz colorida ou a ponta de uma asa",
    emotionalState: "Para quem está numa fase de transição intensa. Sente o desconforto da mudança, mas sabe que está prestes a transformar-se em algo novo. Representa vulnerabilidade e evolução.",
    imagePath: "/avatars/breaking-cocoon.webp"
  },
  {
    id: "mountain-horizon",
    name: "A Montanha no Horizonte",
    description: "Uma silhueta pequena de uma pessoa na base de uma montanha gigante, olhando para o cume",
    emotionalState: "Para quem identificou o tamanho do desafio (o trauma ou o medo) e sente o peso da subida, mas está determinado a começar. Representa determinação perante a adversidade.",
    imagePath: "/avatars/mountain-horizon.webp"
  },
  {
    id: "clearing-mirror",
    name: "O Espelho Embaciado com uma Limpeza",
    description: "Um espelho onde a maior parte do reflexo está turva, mas há uma marca de mão que limpou uma pequena área",
    emotionalState: "Para quem está a começar a questionar as mentiras que conta a si mesmo e está a ter os primeiros vislumbres da sua verdadeira identidade. Representa o início da autodescoberta e da clareza.",
    imagePath: "/avatars/clearing-mirror.webp"
  },
  {
    id: "broken-chain",
    name: "A Corrente Quebrada",
    description: "Um elo de uma corrente de ferro a partir-se, libertando uma energia luminosa",
    emotionalState: "Para o momento de 'aha!', quando o utilizador identifica uma mentira ou medo específico que o prendia e sente o alívio da libertação. Representa liberdade e superação.",
    imagePath: "/avatars/broken-chain.webp"
  },
  {
    id: "inner-sunrise",
    name: "O Nascer do Sol Interior",
    description: "Uma paisagem abstrata do interior de uma caverna, olhando para fora onde um sol dourado está a nascer",
    emotionalState: "Para quem está a começar a ver a 'luz ao fundo do túnel'. Representa otimismo, renovação e a aproximação da identidade plena.",
    imagePath: "/avatars/inner-sunrise.webp"
  }
];
