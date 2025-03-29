# Configuração do Magic Link para RemoteJobsBR

Este documento contém instruções para configurar e usar o sistema de magic link para autenticação de recrutadores na plataforma RemoteJobsBR.

## Configuração do Servidor de Email

Para que o magic link funcione corretamente, você precisa configurar um servidor SMTP para envio de emails. Siga as instruções abaixo:

1. Abra o arquivo `.env` na raiz do projeto
2. Configure as seguintes variáveis de ambiente:

```
EMAIL_USERNAME=seu_email@gmail.com
EMAIL_PASSWORD=sua_senha_ou_app_password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_FROM=noreply@remotejobsbr.com.br
```

### Usando o Gmail

Se você estiver usando o Gmail, siga estas etapas adicionais:

1. Acesse sua conta Google e ative a autenticação de dois fatores
2. Crie uma "Senha de App" específica para esta aplicação
   - Acesse [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   - Selecione "Outro" e dê um nome como "RemoteJobsBR"
   - Use a senha gerada como `EMAIL_PASSWORD` no arquivo `.env`

### Usando outros provedores de email

Para outros provedores, você precisará:
- O endereço do servidor SMTP (EMAIL_HOST)
- A porta do servidor SMTP (EMAIL_PORT)
- Seu nome de usuário de email (EMAIL_USERNAME)
- Sua senha de email (EMAIL_PASSWORD)

## Fluxo de Autenticação

O fluxo de magic link funciona da seguinte forma:

1. O recrutador acessa a página `/auth/recruiter`
2. Insere seu email e clica em "Enviar link de acesso"
3. Um email é enviado com um link de autenticação
4. Ao clicar no link, o recrutador é redirecionado para `/auth/verify`
5. A página de verificação processa o token e redireciona para `/recruiter/dashboard`

## Páginas Disponíveis

- `/auth/recruiter` - Página para solicitar o magic link
- `/auth/verify` - Página de verificação do token
- `/recruiter/dashboard` - Dashboard principal do recrutador
- `/recruiter/dashboard/jobs` - Lista de vagas do recrutador
- `/recruiter/dashboard/jobs/new` - Formulário para criar nova vaga

## Testes e Depuração

Para testar o funcionamento do magic link:

1. Configure corretamente as variáveis de email no `.env`
2. Inicie o servidor com `npm run dev`
3. Acesse `http://localhost:3000/auth/recruiter`
4. Insira um email válido e verifique se o email é recebido
5. Clique no link no email e verifique se a autenticação ocorre corretamente

### Limpeza de Tokens

Os tokens de verificação expirados podem ser limpos automaticamente usando o endpoint:

```
POST /api/auth/clear-tokens
```

Execute esta limpeza periodicamente para manter o banco de dados organizado.

## Solução de Problemas

- **Email não está sendo enviado**: Verifique as credenciais SMTP no arquivo `.env`
- **Erro de autenticação**: Verifique se está usando uma "Senha de App" se estiver com Gmail
- **Token expirado**: Os tokens têm validade limitada, solicite um novo link se necessário
- **Redirecionamento incorreto**: Verifique as configurações de URL no arquivo `.env` 