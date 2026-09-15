-- Permite anexar uma imagem (screenshot/demo) a uma novidade da GLCTech,
-- para dar mais destaque visual na seção "Novidade GLCTech" do boletim.
ALTER TABLE company_news ADD COLUMN image_url TEXT;
