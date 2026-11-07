// Seed: dados iniciais do Open History (execute: npm run seed)
const db = require('./db');
const { hashPassword } = require('./lib/auth');

if (db.prepare('SELECT COUNT(*) AS n FROM users WHERE role = ?').get('admin').n > 0) {
  console.log('Seed ignorado: já existe administrador.');
  process.exit(0);
}

db.prepare(`INSERT INTO users (email, name, password_hash, role, provider) VALUES (?, ?, ?, 'admin', 'email')`)
  .run('admin@openhistory.app', 'Administrador', hashPassword('admin123'));

const facts = [
  ['A biblioteca que sobreviveu ao fogo', 'A Biblioteca de Alexandria foi um dos maiores centros de saber da Antiguidade — e sua destruição ainda é debatida.', 'A Biblioteca de Alexandria, fundada no século III a.C., reunia rolos de papiro de todo o mundo conhecido. Não houve um único incêndio que a destruiu: guerras, falta de verbas e o tempo foram desgastando o acervo ao longo de séculos.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Biblioteca_de_Alexandria', 'Antiguidade', 'Século III a.C.'],
  ['O correio mais rápido do século XIX', 'O Pony Express entregava cartas de Missouri à Califórnia em cerca de 10 dias.', 'Em 1860, o Pony Express cruzava quase 3.200 km de território hostil com cavaleiros revezando a cada 15 km. Durou apenas 18 meses — o telégrafo chegou primeiro e acabou com o serviço.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Pony_Express', 'Modernidade', '1860'],
  ['A cidade que ficou séculos sob a areia', 'Pompéia foi soterrada pelo Vesúvio em 79 d.C. e esquecida por mais de 1.600 anos.', 'A erupção do Vesúvio preservou Pompeia como um instantâneo da vida romana: pães ainda nos fornos, grafites nas paredes e corpos na posição em que caíram.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Pompeia', 'Antiguidade', '79 d.C.'],
  ['O código que encurtou uma guerra', 'A máquina Enigma foi quebrada por matemáticos famosos antes de qualquer bomba.', 'Em Bletchley Park, Alan Turing e sua equipe decifravam mensagens alemãs da Enigma. Estima-se que o trabalho tenha encurtado a Segunda Guerra em dois a quatro anos.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Enigma', 'Século XX', '1939-1945'],
  ['A cidade que mudou de nome', 'Istambul já foi Constantinopla; o nome oficial mudou em 1930.', 'Por séculos, Constantinopla foi a ponte entre Europa e Ásia. Em 1930, a Turquia adotou oficialmente o nome Istambul, já usado desde o período otomano.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Istambul', 'Modernidade', '1930'],
  ['O médico que mandou lavar as mãos', 'Ignaz Semmelweis provou que lavar as mãos salvava vidas — e foi ridicularizado.', 'No século XIX, Semmelweis obrigou médicos a lavarem as mãos com cal clorada, e a mortalidade em sua ala despencou. A comunidade médica levou décadas para aceitar a ideia.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Ignaz_Semmelweis', 'Século XIX', '1847'],
];
const factStmt = db.prepare(`INSERT INTO facts (title, short_desc, full_text, source_name, source_url, category, period) VALUES (?, ?, ?, ?, ?, ?, ?)`);
for (const f of facts) factStmt.run(...f);

const curiosities = [
  ['A Grande Muralha da China não é uma única muralha, mas um sistema de fortificações construído e reconstruído por mais de 2.000 anos.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Muralha_da_China'],
  ['Cleópatra viveu mais perto do nosso tempo do que das pirâmides: a Grande Pirâmide já tinha 2.500 anos quando ela nasceu.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Cleópatra'],
  ['A Universidade de Al-Qarawiyyin, em Fez (Marrocos), é considerada a mais antiga do mundo em funcionamento contínuo — fundada em 859.', 'Wikipédia (pt)', 'https://pt.wikipedia.org/wiki/Universidade_de_Al-Qarawiyyin'],
];
const curStmt = db.prepare(`INSERT INTO curiosities (title, text, source_name, source_url, status) VALUES ('Você sabia?', ?, ?, ?, 'published')`);
for (const c of curiosities) curStmt.run(...c);

const sources = [
  ['Wikipédia (português)', 'https://pt.wikipedia.org', 'enciclopedia', 'Enciclopédia livre e colaborativa — fonte primária para resumos e links de aprofundamento.'],
  ['Europeana', 'https://www.europeana.org', 'acervo', 'Acervo digital europeu com imagens, documentos e objetos históricos.'],
  ['Internet Archive', 'https://archive.org', 'acervo', 'Biblioteca digital com livros, gravações e páginas arquivadas.'],
  ['Projeto Gutenberg', 'https://www.gutenberg.org', 'livro', 'Mais de 70 mil livros em domínio público.'],
];
const srcStmt = db.prepare(`INSERT INTO sources (name, url, type, description) VALUES (?, ?, ?, ?)`);
for (const s of sources) srcStmt.run(...s);

const settings = [
  ['home', { title: 'Open History', subtitle: 'História em pedaços', welcome: 'Explore fatos históricos de fontes confiáveis — um cartão por vez.' }],
  ['sections', { search: true, curiosities: true, feedback: true, support: true }],
  ['feedLimit', 12],
  ['randomRotation', true],
  ['categories', ['Antiguidade', 'Idade Média', 'Modernidade', 'Século XIX', 'Século XX', 'Geral']],
  ['supportEnabled', true],
  ['creator', { name: 'Equipe Open History', avatar: '', bio: 'Pessoas curiosas que acreditam que história boa é história com fonte.', message: 'Obrigado por apoiar um projeto independente e sem anúncios.' }],
  ['goal', { month: new Date().toISOString().slice(0, 7), target: 500, raised: 132 }],
];
const setStmt = db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`);
for (const [k, v] of settings) setStmt.run(k, JSON.stringify(v));

const btnStmt = db.prepare(`INSERT INTO support_buttons (label, type, url, pix_key, pix_name, pix_city, amount, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
btnStmt.run('Pix', 'pix', '', 'contato@openhistory.app', 'Open History', 'BRASIL', '', 1);
btnStmt.run('Ko-fi', 'kofi', 'https://ko-fi.com/openhistory', '', '', '', '', 2);
btnStmt.run('GitHub Sponsors', 'github', 'https://github.com/sponsors', '', '', '', '', 3);

db.prepare(`INSERT INTO support_messages (name, message, visible) VALUES (?, ?, 1)`).run('Marina', 'App lindo e direto. Continuem!');

console.log('Seed concluído.');
console.log('Admin inicial: admin@openhistory.app / admin123 (troque a senha após o primeiro login!)');
