// lang.js - Arquivo central de traduções para todo o site
const translations = {
  pt: {
    // Navegação
    nav: { home: "Início", about: "Sobre", services: "Serviços", team: "Time", clients: "Clientes", work: "Trabalhe Conosco", contact: "Fale Conosco", blog: "Blog" },
    
    // Hero
    hero: { 
      badge: "Monitoramento em tempo real · Zabbix & Grafana", 
      highlight: "Visibilidade Total", 
      line2: "da Sua Infraestrutura", 
      line3: "de TI", 
      desc: "Detectamos falhas antes que impactem seu negócio. Monitoramento inteligente, segurança avançada e suporte especializado — tudo em um único parceiro.", 
      cta1: "Solicitar Diagnóstico", 
      cta2: "Ver Soluções", 
      live: "Ao vivo" 
    },
    
    // Stats
    stats: { 
      monitored: "Devices monitorados via SNMP", 
      capacity: "Capacidade total de monitoramento", 
      sla: "SLA garantido aos clientes", 
      support: "Suporte técnico contínuo" 
    },
    
    // About
    about: { 
      label: "Sobre a GLCTech", 
      title: "Especialistas que garantem a continuidade do seu negócio", 
      desc: "A GLCTech nasceu com um propósito claro: transformar o monitoramento de TI em vantagem competitiva. Nossa abordagem combina tecnologia de ponta com profundo conhecimento técnico para garantir que sua infraestrutura opere no máximo desempenho — sempre.", 
      pillar1: { title: "Expertise em Zabbix", desc: "Equipe altamente qualificada em uma das plataformas líderes de monitoramento, com soluções personalizadas para cada cliente." }, 
      pillar2: { title: "Suporte Abrangente", desc: "Da concepção à manutenção contínua, estamos ao seu lado em todas as etapas do projeto." }, 
      pillar3: { title: "Inovação Tecnológica", desc: "Utilizamos Zabbix, Grafana e as melhores ferramentas do mercado para dashboards precisos e insights acionáveis." } 
    },
    
    // Services
    services: { 
      label: "Nossas Soluções", 
      title: "Tudo o que sua TI precisa,<br>em um único parceiro", 
      subtitle: "Soluções integradas de monitoramento, segurança e backup para manter sua operação estável e protegida.", 
      card1: { num: "Monitoramento", title: "Monitoramento Inteligente com Zabbix", desc: "Acompanhe em tempo real servidores, redes e aplicações com métricas precisas, dashboards personalizados e análise proativa de incidentes.", link: "Saiba mais" }, 
      card2: { num: "Segurança", title: "Segurança Kaspersky em Tempo Real", desc: "Monitore continuamente seus sistemas e detecte ameaças em tempo real, garantindo segurança, desempenho e conformidade em todo o ambiente.", link: "Saiba mais" }, 
      card3: { num: "Backup", title: "Backup Inteligente com Veeam", desc: "Garanta a continuidade dos seus negócios com backups automáticos, recuperação rápida e relatórios completos sobre o status das suas cópias de segurança.", link: "Saiba mais" } 
    },
    
    // Why Us
    whyrus: { 
      label: "Por que a GLCTech", 
      title: "Monitoramento que vai além dos alertas", 
      desc: "Escolher a GLCTech é optar por uma parceira que entende que monitoramento é sobre garantir a continuidade, segurança e eficiência do negócio.", 
      pillar1: { title: "Especialização Comprovada", desc: "Com ampla experiência em Zabbix, dominamos todo o ciclo de implantação — da arquitetura à automação, com as melhores práticas do mercado." }, 
      pillar2: { title: "Abordagem Estratégica", desc: "Não entregamos apenas ferramentas: criamos estratégias sob medida, transformando dados em insights acionáveis para decisões mais rápidas." }, 
      pillar3: { title: "Parceria de Longo Prazo", desc: "Suporte técnico contínuo, atualizações proativas e acompanhamento próximo — sua operação permanece estável e em constante evolução." }, 
      pillar4: { title: "Compromisso com a Excelência", desc: "Qualidade, transparência e inovação em cada solução. Resultados mensuráveis e um ambiente de TI robusto e confiável." }, 
      quote: '"A qualidade dos serviços prestados pela GLCTech é excepcional. Sempre atenciosos e ágeis, demonstram profundo conhecimento em sua área, oferecendo soluções eficazes para qualquer desafio."', 
      author: { name: "Matheus Pires", role: "Presidente — Web+ Telecom" } 
    },
    
    // Team
    team: { 
      label: "Nosso Time", 
      title: "Liderança e especialistas que<br>impulsionam a GLCTech", 
      ceo: { role: "CEO & Fundador", desc: "Fundador da GLCTech e especialista Zabbix, com ampla experiência em infraestrutura e monitoramento de TI. Lidera a visão estratégica da empresa unindo gestão executiva e profundo conhecimento técnico para entregar soluções de alto impacto aos clientes." }, 
      cofounder: { role: "Co-Founder & Dev Operations", desc: "Co-fundador da GLCTech, baseado em Manchester, Inglaterra. Responsável pelas operações de desenvolvimento e pela gestão de clientes internacionais. Sua presença no Reino Unido amplia o alcance da GLCTech para o mercado europeu, garantindo suporte e atendimento além das fronteiras brasileiras." } 
    },
    
    // Testimonials
    testimonials: { 
      label: "Depoimentos", 
      title: "O que nossos clientes dizem", 
      quote1: '"Sempre que precisamos de algo, eles estão dispostos a ajudar. Possuem excelente conhecimento de sua área e entregam soluções de acordo com as nossas necessidades. Recomendo fortemente."', 
      role1: "Presidente — Nordenet", 
      quote2: '"A qualidade dos serviços prestados pela GLCTech é excepcional. Sempre atenciosos e ágeis, demonstram profundo conhecimento e oferecem soluções eficazes para qualquer desafio."', 
      role2: "Presidente — Web+ Telecom" 
    },
    
    // Partners
    partners: { label: "Tecnologias & Parceiros de Confiança" },
    
    // Blog
    blog: { 
      label: "Últimas Novidades", 
      title: "Insights sobre TI e Segurança", 
      subtitle: "Notícias em tempo real sobre segurança cibernética, infraestrutura e tecnologia.", 
      tabAll: "Todos", 
      error: { title: "Feeds temporariamente indisponíveis", visit: "Acesse:" } 
    },
    
    // CTA
    cta: { 
      title: "Pronto para proteger sua infraestrutura?", 
      desc: "Fale com nossos especialistas e descubra como a GLCTech pode transformar o monitoramento da sua empresa.", 
      button: "Iniciar Diagnóstico Gratuito" 
    },
    
    // Contact
    contact: { 
      label: "Fale Conosco", 
      title: "Entre em contato com nossa equipe técnica", 
      desc: "Entre em contato com nossa equipe e descubra como a GLCTech pode otimizar sua infraestrutura de TI. Resposta em até 24h úteis.", 
      emailLabel: "E-mail", 
      phoneLabel: "Telefone / WhatsApp", 
      locationLabel: "Localização", 
      success: { title: "Mensagem enviada!", desc: "Recebemos seu contato e responderemos em até 24h úteis.", new: "Enviar nova mensagem" }, 
      form: { name: "Nome *", company: "Empresa", email: "E-mail *", phone: "Telefone", message: "Mensagem *", submit: "Enviar Mensagem", sending: "Enviando..." } 
    },
    
    // Footer
    footer: { 
      brand: "Monitoramento inteligente e segurança de TI para empresas que exigem alta performance e continuidade operacional.", 
      nav: "Navegação", 
      services: "Serviços", 
      legal: "Legal", 
      privacy: "Política de Privacidade", 
      terms: "Termos de Uso", 
      zabbix: "Zabbix", 
      kaspersky: "Kaspersky", 
      veeam: "Veeam Backup", 
      rights: "Todos os direitos reservados.", 
      location: "São Paulo, SP — Brasil" 
    },
    
    // Zabbix Page
    zabbix: {
      hero: { badge: "Zabbix 7.2 · Monitoramento Corporativo", title: "Visibilidade Total com <span>Zabbix</span>", desc: "Sua empresa com monitoramento completo da infraestrutura de TI — detectando falhas em tempo real e agindo proativamente para evitar impactos nos negócios.", cta1: "Simular Investimento", cta2: "Falar com Especialista" },
      features: { label: "Recursos", title: "O que o Zabbix oferece<br>para sua empresa", subtitle: "Plataforma líder em monitoramento de infraestrutura, com soluções personalizadas pela equipe GLCTech." },
      plans: { label: "Planos", title: "Escolha o plano ideal<br>para sua empresa", subtitle: "Soluções flexíveis e escaláveis que acompanham o crescimento do seu negócio." }
    },
    
    // Veeam Page
    veeam: {
      hero: { badge: "Veeam Data Platform · Backup & Replication", title: "<span>Backup Inteligente</span><br>para sua<br>Infraestrutura", desc: "Garanta a continuidade dos seus negócios com backups automáticos, recuperação rápida e relatórios completos sobre o status das suas cópias de segurança.", cta1: "Simular Investimento", cta2: "Solicitar Proposta" },
      features: { label: "Recursos", title: "Por que o Veeam é a escolha<br>certa para seu backup", subtitle: "A plataforma líder mundial em proteção de dados, gerenciada pela equipe especialista da GLCTech." },
      editions: { label: "Edições", title: "Escolha a edição certa<br>para o seu ambiente", subtitle: "Do backup essencial à proteção total contra ransomware — uma plataforma para cada necessidade." }
    },
    
    // Kaspersky Page
    kaspersky: {
      hero: { badge: "Kaspersky SMB · Cibersegurança Corporativa", title: "<span>Segurança em</span><br>Tempo Real<br>para sua Empresa", desc: "Proteção corporativa com simplicidade e eficiência para pequenas e médias empresas — detecte ameaças em tempo real com a tecnologia Kaspersky.", cta1: "Simular Investimento", cta2: "Solicitar Proposta" },
      features: { label: "Proteção Multicamadas", title: "O que o Kaspersky SMB<br>oferece para sua empresa", subtitle: "Proteção completa, escalável e de fácil gerenciamento para empresas em crescimento." },
      about: { label: "Kaspersky Next EDR Foundations", title: "Proteção empresarial sem complexidade", desc: "O Kaspersky SMB Security foi desenvolvido para empresas em expansão que precisam de soluções robustas, acessíveis e de fácil gerenciamento." }
    },
    
    // Legal Pages
    legal: {
      privacy: { title: "Política de Privacidade", lastUpdate: "Última atualização: 08 de julho de 2025" },
      terms: { title: "Termos de Uso", lastUpdate: "Última atualização: 08 de julho de 2025" }
    }
  },
  
  en: {
    nav: { home: "Home", about: "About", services: "Services", team: "Team", clients: "Clients", work: "Work with Us", contact: "Contact Us", blog: "Blog" },
    hero: { badge: "Real-time monitoring · Zabbix & Grafana", highlight: "Total Visibility", line2: "of Your IT", line3: "Infrastructure", desc: "We detect failures before they impact your business. Intelligent monitoring, advanced security, and specialized support — all in one partner.", cta1: "Request Diagnosis", cta2: "See Solutions", live: "Live" },
    stats: { monitored: "Devices monitored via SNMP", capacity: "Total monitoring capacity", sla: "SLA guaranteed to clients", support: "24/7 technical support" },
    about: { label: "About GLCTech", title: "Experts ensuring your business continuity", desc: "GLCTech was born with a clear purpose: to transform IT monitoring into a competitive advantage. Our approach combines cutting-edge technology with deep technical knowledge to ensure your infrastructure operates at peak performance — always.", pillar1: { title: "Zabbix Expertise", desc: "Highly qualified team in one of the leading monitoring platforms, with customized solutions for each client." }, pillar2: { title: "Comprehensive Support", desc: "From conception to ongoing maintenance, we are by your side at every stage of the project." }, pillar3: { title: "Technological Innovation", desc: "We use Zabbix, Grafana and the best market tools for precise dashboards and actionable insights." } },
    services: { label: "Our Solutions", title: "Everything your IT needs,<br>in one partner", subtitle: "Integrated monitoring, security and backup solutions to keep your operation stable and protected.", card1: { num: "Monitoring", title: "Intelligent Monitoring with Zabbix", desc: "Track servers, networks and applications in real time with precise metrics, personalized dashboards and proactive incident analysis.", link: "Learn more" }, card2: { num: "Security", title: "Real-time Kaspersky Security", desc: "Continuously monitor your systems and detect threats in real time, ensuring security, performance and compliance across your entire environment.", link: "Learn more" }, card3: { num: "Backup", title: "Intelligent Backup with Veeam", desc: "Ensure business continuity with automated backups, fast recovery and complete reports on the status of your backups.", link: "Learn more" } },
    whyrus: { label: "Why GLCTech", title: "Monitoring that goes beyond alerts", desc: "Choosing GLCTech means choosing a partner who understands that monitoring is about ensuring business continuity, security and efficiency.", pillar1: { title: "Proven Expertise", desc: "With extensive Zabbix experience, we master the entire deployment cycle — from architecture to automation, with market best practices." }, pillar2: { title: "Strategic Approach", desc: "We don't just deliver tools: we create tailored strategies, transforming data into actionable insights for faster decisions." }, pillar3: { title: "Long-term Partnership", desc: "Continuous technical support, proactive updates and close follow-up — your operation remains stable and constantly evolving." }, pillar4: { title: "Commitment to Excellence", desc: "Quality, transparency and innovation in every solution. Measurable results and a robust, reliable IT environment." }, quote: '"The quality of services provided by GLCTech is exceptional. Always attentive and agile, they demonstrate deep knowledge in their area, offering effective solutions to any challenge."', author: { name: "Matheus Pires", role: "President — Web+ Telecom" } },
    team: { label: "Our Team", title: "Leadership and experts that<br>drive GLCTech", ceo: { role: "CEO & Founder", desc: "Founder of GLCTech and Zabbix specialist, with extensive experience in IT infrastructure and monitoring. Leads the company's strategic vision, combining executive management with deep technical knowledge to deliver high-impact solutions to clients." }, cofounder: { role: "Co-Founder & Dev Operations", desc: "Co-founder of GLCTech, based in Manchester, England. Responsible for development operations and international client management. His presence in the UK expands GLCTech's reach to the European market, ensuring support and service beyond Brazilian borders." } },
    testimonials: { label: "Testimonials", title: "What our clients say", quote1: '"Whenever we need something, they are willing to help. They have excellent knowledge of their area and deliver solutions according to our needs. I highly recommend them."', role1: "President — Nordenet", quote2: '"The quality of services provided by GLCTech is exceptional. Always attentive and agile, they demonstrate deep knowledge and offer effective solutions to any challenge."', role2: "President — Web+ Telecom" },
    partners: { label: "Technologies & Trusted Partners" },
    blog: { label: "Latest News", title: "IT and Security Insights", subtitle: "Real-time news about cybersecurity, infrastructure and technology.", tabAll: "All", error: { title: "Feeds temporarily unavailable", visit: "Visit:" } },
    cta: { title: "Ready to protect your infrastructure?", desc: "Talk to our experts and find out how GLCTech can transform your company's monitoring.", button: "Start Free Diagnosis" },
    contact: { label: "Contact Us", title: "Get in touch with our technical team", desc: "Contact our team and find out how GLCTech can optimize your IT infrastructure. Response within 24 business hours.", emailLabel: "E-mail", phoneLabel: "Phone / WhatsApp", locationLabel: "Location", success: { title: "Message sent!", desc: "We have received your message and will respond within 24 business hours.", new: "Send new message" }, form: { name: "Name *", company: "Company", email: "E-mail *", phone: "Phone", message: "Message *", submit: "Send Message", sending: "Sending..." } },
    footer: { brand: "Intelligent IT monitoring and security for companies that demand high performance and operational continuity.", nav: "Navigation", services: "Services", legal: "Legal", privacy: "Privacy Policy", terms: "Terms of Use", zabbix: "Zabbix", kaspersky: "Kaspersky", veeam: "Veeam Backup", rights: "All rights reserved.", location: "São Paulo, SP — Brazil" },
    zabbix: { hero: { badge: "Zabbix 7.2 · Enterprise Monitoring", title: "Total Visibility with <span>Zabbix</span>", desc: "Your company with complete IT infrastructure monitoring — detecting failures in real time and acting proactively to avoid business impacts.", cta1: "Simulate Investment", cta2: "Talk to Specialist" }, features: { label: "Features", title: "What Zabbix offers<br>for your business", subtitle: "Leading infrastructure monitoring platform, with customized solutions by the GLCTech team." }, plans: { label: "Plans", title: "Choose the ideal plan<br>for your business", subtitle: "Flexible and scalable solutions that grow with your business." } },
    veeam: { hero: { badge: "Veeam Data Platform · Backup & Replication", title: "<span>Intelligent Backup</span><br>for your<br>Infrastructure", desc: "Ensure business continuity with automated backups, fast recovery and complete reports on the status of your backups.", cta1: "Simulate Investment", cta2: "Request Quote" }, features: { label: "Features", title: "Why Veeam is the right<br>choice for your backup", subtitle: "The world's leading data protection platform, managed by GLCTech's expert team." }, editions: { label: "Editions", title: "Choose the right edition<br>for your environment", subtitle: "From essential backup to total ransomware protection — one platform for every need." } },
    kaspersky: { hero: { badge: "Kaspersky SMB · Corporate Cybersecurity", title: "<span>Real-Time</span><br>Security<br>for Your Business", desc: "Corporate protection with simplicity and efficiency for small and medium businesses — detect threats in real time with Kaspersky technology.", cta1: "Simulate Investment", cta2: "Request Quote" }, features: { label: "Multi-Layer Protection", title: "What Kaspersky SMB<br>offers your business", subtitle: "Complete, scalable and easy-to-manage protection for growing businesses." }, about: { label: "Kaspersky Next EDR Foundations", title: "Enterprise protection without complexity", desc: "Kaspersky SMB Security was developed for growing businesses that need robust, accessible and easy-to-manage solutions." } },
    legal: { privacy: { title: "Privacy Policy", lastUpdate: "Last updated: July 8, 2025" }, terms: { title: "Terms of Use", lastUpdate: "Last updated: July 8, 2025" } }
  },
  
  es: {
    nav: { home: "Inicio", about: "Sobre", services: "Servicios", team: "Equipo", clients: "Clientes", work: "Trabaja con Nosotros", contact: "Contáctenos", blog: "Blog" },
    hero: { badge: "Monitoreo en tiempo real · Zabbix y Grafana", highlight: "Visibilidad Total", line2: "de su Infraestructura", line3: "de TI", desc: "Detectamos fallos antes de que afecten a su negocio. Monitoreo inteligente, seguridad avanzada y soporte especializado — todo en un solo socio.", cta1: "Solicitar Diagnóstico", cta2: "Ver Soluciones", live: "En vivo" },
    stats: { monitored: "Dispositivos monitoreados vía SNMP", capacity: "Capacidad total de monitoreo", sla: "SLA garantizado a clientes", support: "Soporte técnico 24/7" },
    about: { label: "Sobre GLCTech", title: "Expertos que garantizan la continuidad de su negocio", desc: "GLCTech nació con un propósito claro: transformar el monitoreo de TI en una ventaja competitiva. Nuestro enfoque combina tecnología de vanguardia con un profundo conocimiento técnico para garantizar que su infraestructura funcione al máximo rendimiento — siempre.", pillar1: { title: "Experiencia en Zabbix", desc: "Equipo altamente calificado en una de las plataformas líderes de monitoreo, con soluciones personalizadas para cada cliente." }, pillar2: { title: "Soporte Integral", desc: "Desde la concepción hasta el mantenimiento continuo, estamos a su lado en cada etapa del proyecto." }, pillar3: { title: "Innovación Tecnológica", desc: "Utilizamos Zabbix, Grafana y las mejores herramientas del mercado para paneles precisos e insights procesables." } },
    services: { label: "Nuestras Soluciones", title: "Todo lo que su TI necesita,<br>en un solo socio", subtitle: "Soluciones integradas de monitoreo, seguridad y respaldo para mantener su operación estable y protegida.", card1: { num: "Monitoreo", title: "Monitoreo Inteligente con Zabbix", desc: "Monitoree en tiempo real servidores, redes y aplicaciones con métricas precisas, paneles personalizados y análisis proactivo de incidentes.", link: "Más información" }, card2: { num: "Seguridad", title: "Seguridad Kaspersky en Tiempo Real", desc: "Monitoree continuamente sus sistemas y detecte amenazas en tiempo real, garantizando seguridad, rendimiento y cumplimiento en todo su entorno.", link: "Más información" }, card3: { num: "Respaldo", title: "Respaldo Inteligente con Veeam", desc: "Garantice la continuidad de su negocio con respaldos automáticos, recuperación rápida e informes completos sobre el estado de sus copias de seguridad.", link: "Más información" } },
    whyrus: { label: "Por qué GLCTech", title: "Monitoreo que va más allá de las alertas", desc: "Elegir GLCTech es optar por un socio que entiende que el monitoreo es garantizar la continuidad, seguridad y eficiencia del negocio.", pillar1: { title: "Experiencia Comprobada", desc: "Con amplia experiencia en Zabbix, dominamos todo el ciclo de implementación — desde la arquitectura hasta la automatización, con las mejores prácticas del mercado." }, pillar2: { title: "Enfoque Estratégico", desc: "No solo entregamos herramientas: creamos estrategias a medida, transformando datos en insights procesables para decisiones más rápidas." }, pillar3: { title: "Asociación a Largo Plazo", desc: "Soporte técnico continuo, actualizaciones proactivas y seguimiento cercano — su operación se mantiene estable y en constante evolución." }, pillar4: { title: "Compromiso con la Excelencia", desc: "Calidad, transparencia e innovación en cada solución. Resultados medibles y un entorno de TI robusto y confiable." }, quote: '"La calidad de los servicios prestados por GLCTech es excepcional. Siempre atentos y ágiles, demuestran un profundo conocimiento en su área, ofreciendo soluciones efectivas para cualquier desafío."', author: { name: "Matheus Pires", role: "Presidente — Web+ Telecom" } },
    team: { label: "Nuestro Equipo", title: "Liderazgo y expertos que<br>impulsan GLCTech", ceo: { role: "CEO & Fundador", desc: "Fundador de GLCTech y especialista en Zabbix, con amplia experiencia en infraestructura y monitoreo de TI. Lidera la visión estratégica de la empresa combinando gestión ejecutiva con profundo conocimiento técnico para entregar soluciones de alto impacto a los clientes." }, cofounder: { role: "Co-Fundador & Dev Operations", desc: "Co-fundador de GLCTech, con base en Manchester, Inglaterra. Responsable de las operaciones de desarrollo y la gestión de clientes internacionales. Su presencia en el Reino Unido amplía el alcance de GLCTech al mercado europeo, garantizando soporte y atención más allá de las fronteras brasileñas." } },
    testimonials: { label: "Testimonios", title: "Lo que dicen nuestros clientes", quote1: '"Siempre que necesitamos algo, están dispuestos a ayudar. Tienen un excelente conocimiento de su área y entregan soluciones de acuerdo a nuestras necesidades. Lo recomiendo encarecidamente."', role1: "Presidente — Nordenet", quote2: '"La calidad de los servicios prestados por GLCTech es excepcional. Siempre atentos y ágiles, demuestran un profundo conocimiento y ofrecen soluciones efectivas para cualquier desafío."', role2: "Presidente — Web+ Telecom" },
    partners: { label: "Tecnologías y Socios de Confianza" },
    blog: { label: "Últimas Novedades", title: "Perspectivas sobre TI y Seguridad", subtitle: "Noticias en tiempo real sobre ciberseguridad, infraestructura y tecnología.", tabAll: "Todos", error: { title: "Feeds temporalmente no disponibles", visit: "Visite:" } },
    cta: { title: "¿Listo para proteger su infraestructura?", desc: "Hable con nuestros expertos y descubra cómo GLCTech puede transformar el monitoreo de su empresa.", button: "Iniciar Diagnóstico Gratuito" },
    contact: { label: "Contáctenos", title: "Póngase en contacto con nuestro equipo técnico", desc: "Contacte a nuestro equipo y descubra cómo GLCTech puede optimizar su infraestructura de TI. Respuesta en hasta 24 horas hábiles.", emailLabel: "Correo electrónico", phoneLabel: "Teléfono / WhatsApp", locationLabel: "Ubicación", success: { title: "¡Mensaje enviado!", desc: "Recibimos su mensaje y responderemos en un plazo de 24 horas hábiles.", new: "Enviar nuevo mensaje" }, form: { name: "Nombre *", company: "Empresa", email: "Correo electrónico *", phone: "Teléfono", message: "Mensaje *", submit: "Enviar Mensaje", sending: "Enviando..." } },
    footer: { brand: "Monitoreo de TI inteligente y seguridad para empresas que exigen alto rendimiento y continuidad operativa.", nav: "Navegación", services: "Servicios", legal: "Legal", privacy: "Política de Privacidad", terms: "Términos de Uso", zabbix: "Zabbix", kaspersky: "Kaspersky", veeam: "Veeam Backup", rights: "Todos los derechos reservados.", location: "São Paulo, SP — Brasil" },
    zabbix: { hero: { badge: "Zabbix 7.2 · Monitoreo Corporativo", title: "Visibilidad Total con <span>Zabbix</span>", desc: "Su empresa con monitoreo completo de infraestructura de TI — detectando fallas en tiempo real y actuando proactivamente para evitar impactos en el negocio.", cta1: "Simular Inversión", cta2: "Hablar con Especialista" }, features: { label: "Características", title: "Lo que Zabbix ofrece<br>para su empresa", subtitle: "Plataforma líder en monitoreo de infraestructura, con soluciones personalizadas por el equipo de GLCTech." }, plans: { label: "Planes", title: "Elija el plan ideal<br>para su empresa", subtitle: "Soluciones flexibles y escalables que crecen con su negocio." } },
    veeam: { hero: { badge: "Veeam Data Platform · Backup & Replication", title: "<span>Respaldo Inteligente</span><br>para su<br>Infraestructura", desc: "Garantice la continuidad de su negocio con respaldos automáticos, recuperación rápida e informes completos sobre el estado de sus copias de seguridad.", cta1: "Simular Inversión", cta2: "Solicitar Propuesta" }, features: { label: "Características", title: "Por qué Veeam es la elección<br>correcta para su respaldo", subtitle: "La plataforma líder mundial en protección de datos, gestionada por el equipo experto de GLCTech." }, editions: { label: "Ediciones", title: "Elija la edición correcta<br>para su entorno", subtitle: "Desde respaldo esencial hasta protección total contra ransomware — una plataforma para cada necesidad." } },
    kaspersky: { hero: { badge: "Kaspersky SMB · Ciberseguridad Corporativa", title: "<span>Seguridad en</span><br>Tiempo Real<br>para su Empresa", desc: "Protección corporativa con simplicidad y eficiencia para pequeñas y medianas empresas — detecte amenazas en tiempo real con la tecnología Kaspersky.", cta1: "Simular Inversión", cta2: "Solicitar Propuesta" }, features: { label: "Protección Multicapa", title: "Lo que Kaspersky SMB<br>ofrece a su empresa", subtitle: "Protección completa, escalable y fácil de gestionar para empresas en crecimiento." }, about: { label: "Kaspersky Next EDR Foundations", title: "Protección empresarial sin complejidad", desc: "Kaspersky SMB Security fue desarrollado para empresas en crecimiento que necesitan soluciones robustas, accesibles y fáciles de gestionar." } },
    legal: { privacy: { title: "Política de Privacidad", lastUpdate: "Última actualización: 8 de julio de 2025" }, terms: { title: "Términos de Uso", lastUpdate: "Última actualización: 8 de julio de 2025" } }
  }
};

let currentLang = 'pt';

function detectLanguage() {
  const saved = localStorage.getItem('glc_lang');
  if (saved && translations[saved]) return saved;
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang.startsWith('en')) return 'en';
  if (browserLang.startsWith('es')) return 'es';
  return 'pt';
}

function setLanguage(lang) {
  if (!translations[lang]) lang = 'pt';
  currentLang = lang;
  
  // Atualizar botões ativos
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === lang) btn.classList.add('active');
    else btn.classList.remove('active');
  });
  
  const t = translations[lang];
  
  // Traduzir elementos com data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const path = el.getAttribute('data-i18n');
    const value = path.split('.').reduce((obj, key) => obj && obj[key], t);
    if (value !== undefined && value !== null) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.placeholder !== undefined) el.placeholder = value;
      } else if (el.tagName === 'BUTTON' && el.querySelector('span')) {
        // Skip, handled separately
      } else {
        el.innerHTML = value;
      }
    }
  });
  
  localStorage.setItem('glc_lang', lang);
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  
  // Disparar evento para que outras páginas saibam que o idioma mudou
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: lang, translations: t } }));
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const detectedLang = detectLanguage();
  setLanguage(detectedLang);
  
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setLanguage(btn.dataset.lang);
    });
  });
});
