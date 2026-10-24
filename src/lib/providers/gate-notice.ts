/** The closed-provider notice, in the caller's own language.
 *
 *  A refusal a reader cannot read is a refusal they will read as a fault. The
 *  notice is therefore written out in the languages the line is most likely to
 *  be asked in, and the reply is composed in whichever one the request itself
 *  is written in — detected from the message the caller sent, not guessed from
 *  a header alone.
 *
 *  Every translation carries the same four facts, because they are the whole
 *  answer: the provider is closed on purpose, the condition is 100,000 stars on
 *  the public repository, the closure is permanent rather than a quota or an
 *  outage, and here is the link to move the number.
 *
 *  The two URLs are never translated and never localised, so they stay
 *  copyable and clickable in any client. */
import { STAR_GOAL, STAR_REPO, STAR_REPO_URL } from "./star-gate";

export const SITE_URL = "https://zyraxonai.lovable.app";

type Copy = {
  /** The one-line headline. */
  title: string;
  /** The explanation. `{goal}` is substituted with the formatted target. */
  body: string;
  /** The live count line. `{stars}`, `{goal}`, `{remaining}` are substituted. */
  count: string;
  /** What the reader can do. `{repo}` is substituted with the repository name. */
  help: string;
};

/** English is the fallback and the shape every other entry follows. */
const EN: Copy = {
  title: "The ZYRAXON provider is not open yet",
  body: "Our own provider is switched off on purpose until this repository reaches {goal} stars on GitHub. This is permanent: it is not a quota that resets and not an outage. When the count reaches the goal we stand up our own company and our own provider, and this endpoint starts answering.",
  count: "Stars right now: {stars} / {goal} — {remaining} to go.",
  help: "Star {repo} to move the number: {repoUrl}",
};

export const GATE_COPY: Record<string, Copy> = {
  en: EN,

  bn: {
    title: "ZYRAXON প্রোভাইডার এখনো চালু হয়নি",
    body: "আমাদের নিজস্ব প্রোভাইডার ইচ্ছাকৃতভাবে বন্ধ রাখা হয়েছে, যতক্ষণ না এই রিপোজিটরি GitHub-এ {goal} স্টার পায়। এটি স্থায়ী: এটি রিসেট হওয়া কোনো কোটা নয়, কোনো সাময়িক সমস্যাও নয়। লক্ষ্য পূরণ হলে আমরা আমাদের নিজস্ব কোম্পানি ও নিজস্ব প্রোভাইডার চালু করব, এবং তখন এই এন্ডপয়েন্ট উত্তর দিতে শুরু করবে।",
    count: "এখন স্টার: {stars} / {goal} — আরও {remaining}টি বাকি।",
    help: "স্টার দিন {repo} — {repoUrl}",
  },

  hi: {
    title: "ZYRAXON प्रोवाइडर अभी चालू नहीं है",
    body: "हमारा अपना प्रोवाइडर जानबूझकर बंद है, जब तक यह रिपॉज़िटरी GitHub पर {goal} स्टार नहीं पाती। यह स्थायी है: यह रीसेट होने वाला कोटा नहीं है और कोई अस्थायी खराबी नहीं है। लक्ष्य पूरा होने पर हम अपनी कंपनी और अपना प्रोवाइडर शुरू करेंगे, और तब यह एंडपॉइंट जवाब देना शुरू करेगा।",
    count: "अभी स्टार: {stars} / {goal} — अभी {remaining} बाकी।",
    help: "{repo} को स्टार करें — {repoUrl}",
  },

  ar: {
    title: "مزوّد ZYRAXON غير مُفعَّل بعد",
    body: "مزوّدنا الخاص مُعطَّل عن قصد حتى يصل هذا المستودع إلى {goal} نجمة على GitHub. هذا دائم: ليس حصةً تُعاد ضبطها وليس عطلاً مؤقتاً. وعندما يبلغ العدد الهدف سننشئ شركتنا الخاصة ومزوّدنا الخاص، وحينها يبدأ هذا المسار في الرد.",
    count: "عدد النجوم الآن: {stars} / {goal} — بقي {remaining}.",
    help: "أضف نجمة إلى {repo} — {repoUrl}",
  },

  fa: {
    title: "ارائه‌دهنده ZYRAXON هنوز باز نشده است",
    body: "ارائه‌دهنده خودمان تا زمانی که این مخزن در GitHub به {goal} ستاره برسد، عمداً خاموش است. این دائمی است: نه سهمیه‌ای است که بازنشانی شود و نه یک قطعی موقت. وقتی شمارش به هدف برسد، شرکت خودمان و ارائه‌دهنده خودمان را راه‌اندازی می‌کنیم و این نقطه پایانی پاسخ دادن را آغاز می‌کند.",
    count: "ستاره‌ها همین حالا: {stars} / {goal} — {remaining} باقی مانده.",
    help: "به {repo} ستاره بدهید — {repoUrl}",
  },

  es: {
    title: "El proveedor ZYRAXON aún no está abierto",
    body: "Nuestro propio proveedor está apagado a propósito hasta que este repositorio alcance {goal} estrellas en GitHub. Esto es permanente: no es una cuota que se reinicia ni una caída. Cuando el contador llegue a la meta levantaremos nuestra propia empresa y nuestro propio proveedor, y entonces este endpoint empezará a responder.",
    count: "Estrellas ahora mismo: {stars} / {goal} — faltan {remaining}.",
    help: "Da una estrella a {repo} — {repoUrl}",
  },

  fr: {
    title: "Le fournisseur ZYRAXON n'est pas encore ouvert",
    body: "Notre propre fournisseur est désactivé volontairement jusqu'à ce que ce dépôt atteigne {goal} étoiles sur GitHub. C'est définitif : ni un quota qui se réinitialise, ni une panne. Quand le compteur atteindra l'objectif, nous lancerons notre propre société et notre propre fournisseur, et cet endpoint commencera alors à répondre.",
    count: "Étoiles à l'instant : {stars} / {goal} — {remaining} restantes.",
    help: "Ajoutez une étoile à {repo} — {repoUrl}",
  },

  de: {
    title: "Der ZYRAXON-Provider ist noch nicht offen",
    body: "Unser eigener Provider ist absichtlich abgeschaltet, bis dieses Repository {goal} Sterne auf GitHub erreicht. Das ist dauerhaft: kein Kontingent, das sich zurücksetzt, und kein Ausfall. Wenn der Zähler das Ziel erreicht, gründen wir unser eigenes Unternehmen und unseren eigenen Provider, und dieser Endpunkt beginnt zu antworten.",
    count: "Sterne gerade jetzt: {stars} / {goal} — noch {remaining}.",
    help: "Gib {repo} einen Stern — {repoUrl}",
  },

  pt: {
    title: "O provedor ZYRAXON ainda não está aberto",
    body: "Nosso próprio provedor está desligado de propósito até que este repositório alcance {goal} estrelas no GitHub. Isto é permanente: não é uma cota que se reinicia nem uma indisponibilidade. Quando o contador atingir a meta, criaremos nossa própria empresa e nosso próprio provedor, e este endpoint começará a responder.",
    count: "Estrelas agora: {stars} / {goal} — faltam {remaining}.",
    help: "Dê uma estrela em {repo} — {repoUrl}",
  },

  ru: {
    title: "Провайдер ZYRAXON ещё не открыт",
    body: "Наш собственный провайдер отключён намеренно, пока этот репозиторий не наберёт {goal} звёзд на GitHub. Это навсегда: это не квота, которая сбрасывается, и не сбой. Когда счётчик достигнет цели, мы запустим собственную компанию и собственный провайдер, и тогда эта конечная точка начнёт отвечать.",
    count: "Звёзд сейчас: {stars} / {goal} — осталось {remaining}.",
    help: "Поставьте звезду {repo} — {repoUrl}",
  },

  tr: {
    title: "ZYRAXON sağlayıcısı henüz açık değil",
    body: "Kendi sağlayıcımız, bu depo GitHub'da {goal} yıldıza ulaşana kadar bilerek kapalı. Bu kalıcıdır: sıfırlanan bir kota ya da geçici bir kesinti değil. Sayaç hedefe ulaştığında kendi şirketimizi ve kendi sağlayıcımızı kurup açacağız; o zaman bu uç nokta yanıt vermeye başlayacak.",
    count: "Şu andaki yıldız: {stars} / {goal} — {remaining} kaldı.",
    help: "{repo} deposuna yıldız verin — {repoUrl}",
  },

  id: {
    title: "Penyedia ZYRAXON belum dibuka",
    body: "Penyedia kami sendiri sengaja dimatikan sampai repositori ini mencapai {goal} bintang di GitHub. Ini permanen: bukan kuota yang direset dan bukan gangguan. Saat hitungan mencapai target, kami akan mendirikan perusahaan kami sendiri dan penyedia kami sendiri, dan endpoint ini akan mulai menjawab.",
    count: "Bintang saat ini: {stars} / {goal} — sisa {remaining}.",
    help: "Beri bintang pada {repo} — {repoUrl}",
  },

  vi: {
    title: "Nhà cung cấp ZYRAXON chưa mở",
    body: "Nhà cung cấp của chúng tôi bị tắt có chủ đích cho đến khi kho lưu trữ này đạt {goal} sao trên GitHub. Điều này là vĩnh viễn: không phải hạn mức được đặt lại và cũng không phải sự cố. Khi số sao đạt mục tiêu, chúng tôi sẽ thành lập công ty riêng và nhà cung cấp riêng, và endpoint này sẽ bắt đầu trả lời.",
    count: "Sao hiện tại: {stars} / {goal} — còn {remaining}.",
    help: "Tặng sao cho {repo} — {repoUrl}",
  },

  zh: {
    title: "ZYRAXON 提供商尚未开放",
    body: "我们自己的提供商被有意关闭，直到本仓库在 GitHub 上获得 {goal} 颗星。这是永久的：它不是会重置的配额，也不是故障。当计数达到目标时，我们将成立自己的公司并启用自己的提供商，届时此接口将开始应答。",
    count: "当前星数：{stars} / {goal} — 还差 {remaining}。",
    help: "为 {repo} 加星 — {repoUrl}",
  },

  ja: {
    title: "ZYRAXON プロバイダーはまだ開設されていません",
    body: "私たち自身のプロバイダーは、このリポジトリが GitHub で {goal} スターに達するまで意図的に停止しています。これは恒久的なもので、リセットされる割り当てでも障害でもありません。カウントが目標に達したら、私たちは自社と独自のプロバイダーを立ち上げ、このエンドポイントが応答を開始します。",
    count: "現在のスター数: {stars} / {goal} — あと {remaining}。",
    help: "{repo} にスターを — {repoUrl}",
  },

  ko: {
    title: "ZYRAXON 프로바이더는 아직 열리지 않았습니다",
    body: "우리 자체 프로바이더는 이 저장소가 GitHub에서 별 {goal}개에 도달할 때까지 의도적으로 꺼져 있습니다. 이는 영구적입니다. 초기화되는 할당량도, 일시적인 장애도 아닙니다. 목표에 도달하면 우리는 자체 회사와 자체 프로바이더를 세우고, 그때 이 엔드포인트가 응답하기 시작합니다.",
    count: "현재 별 수: {stars} / {goal} — {remaining}개 남음.",
    help: "{repo}에 별을 주세요 — {repoUrl}",
  },
};

/** The notice in `locale`, or English when we have no copy for it.
 *
 *  `stars` is the live count, or null when GitHub could not be read. The count
 *  line is then replaced with a sentence that says so, rather than printing a
 *  zero the reader would take as the real number. */
export function gateNotice(locale: string | undefined, stars: number | null): string {
  const copy = (locale && GATE_COPY[locale]) || EN;
  const n = (v: number) => v.toLocaleString("en-US");
  const remaining = stars === null ? null : Math.max(0, STAR_GOAL - stars);

  const countLine =
    stars === null
      ? locale && locale !== "en"
        ? `(${EN.count.replace("{stars}", "?").replace("{goal}", n(STAR_GOAL)).replace("{remaining}", "?")})`
        : EN.count
            .replace("{stars}", "?")
            .replace("{goal}", n(STAR_GOAL))
            .replace("{remaining}", "?")
      : copy.count
          .replace("{stars}", n(stars))
          .replace("{goal}", n(STAR_GOAL))
          .replace("{remaining}", n(remaining ?? 0));

  return [
    copy.title + ".",
    copy.body.replace("{goal}", n(STAR_GOAL)),
    countLine,
    copy.help.replace("{repo}", STAR_REPO).replace("{repoUrl}", STAR_REPO_URL),
    `${SITE_URL}/providers`,
  ].join("\n");
}

/** Pick the language for a reply.
 *
 *  Content first: the language the caller actually wrote in is better evidence
 *  than a header, and a client that sends `Accept-Language: en-US` while asking
 *  a question in Bengali should be answered in Bengali. The header is the
 *  fallback, because a caller writing Latin script (Spanish, Turkish) has no
 *  script for the detector to see. English is the last resort. */
export function pickLocale(input: {
  contentLocale?: string;
  acceptLanguage?: string | null;
}): string {
  if (input.contentLocale && GATE_COPY[input.contentLocale]) return input.contentLocale;
  const header = input.acceptLanguage || "";
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase();
    if (!tag) continue;
    const base = tag.split("-")[0];
    if (GATE_COPY[base]) return base;
  }
  return "en";
}
