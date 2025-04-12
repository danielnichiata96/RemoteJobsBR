/**
 * Utilitários para gerenciar logos de empresas
 * Centraliza a lógica de obtenção de logos usando logo.dev
 */

/**
 * Extrai o domínio de uma URL
 * @param {string} url - URL completa do site
 * @returns {string|null} Domínio extraído ou null em caso de erro
 */
export function extractDomain(url: string): string | null {
  if (!url) return null;
  
  try {
    // Adicionar protocolo se não existir
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const urlObj = new URL(url);
    // Remover 'www.' do início, se existir
    return urlObj.hostname.replace(/^www\./, '');
  } catch (error) {
    console.warn(`Erro ao extrair domínio de ${url}:`, error);
    return null;
  }
}

/**
 * Obtem a URL do logo usando o serviço logo.dev
 * @param {string|object} company - Nome da empresa ou objeto com propriedade name
 * @param {string|null} website - Website da empresa (opcional, para extração de domínio)
 * @returns {string} URL para o logo da empresa
 */
export function getCompanyLogo(company: string | { name?: string; website?: string; logo?: string }, fallbackWebsite?: string): string {
  // Verificar se já temos um logo predefinido
  if (typeof company === 'object' && company.logo) {
    return company.logo;
  }
  
  // Obter nome da empresa
  let companyName = '';
  let website = fallbackWebsite || '';
  
  if (typeof company === 'string') {
    companyName = company;
  } else if (company && typeof company === 'object') {
    companyName = company.name || '';
    website = company.website || website;
  }
  
  if (!companyName && !website) {
    return ''; // Se não temos nem nome nem site, retornar vazio
  }
  
  // Tentar obter o domínio do website primeiro
  const domain = website ? extractDomain(website) : null;
  
  // Usar API token se disponível
  const apiToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || '';
  const tokenParam = apiToken ? `?token=${apiToken}` : '';
  
  // Se temos um domínio válido, usá-lo diretamente
  if (domain) {
    return `https://img.logo.dev/${domain}${tokenParam}`;
  }
  
  // Caso contrário, usar o nome da empresa
  if (companyName) {
    // Verificar se o nome já é um domínio
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;
    let domainOrFormattedName = companyName.trim().toLowerCase();
    
    if (!domainPattern.test(domainOrFormattedName)) {
      // Se não for um domínio, formatar (adicionar .com se não tiver TLD)
      if (!domainOrFormattedName.includes('.')) {
        domainOrFormattedName = domainOrFormattedName.replace(/\s+/g, '') + '.com';
      } else {
        // Se tem um TLD mas não é um padrão de domínio válido,
        // apenas limpar espaços
        domainOrFormattedName = domainOrFormattedName.replace(/\s+/g, '');
      }
    }
    
    return `https://img.logo.dev/${domainOrFormattedName}${tokenParam}`;
  }
  
  return ''; // Fallback se nada funcionar
} 