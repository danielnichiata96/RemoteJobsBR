import { sendEmail } from '../../src/lib/email';
import sgMail from '@sendgrid/mail';

// Mock the @sendgrid/mail library
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

// Clear mocks and restore environment variables before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Restore original process.env
  process.env = { ...originalEnv }; 
});

const originalEnv = process.env; // Store original env

describe('sendEmail Utility', () => {
  const testEmailOptions = {
    to: 'test@example.com',
    subject: 'Test Subject',
    html: '<p>Test HTML</p>',
    text: 'Test Text',
  };
  const expectedFrom = 'noreply@remotejobsbr.com'; // Default from address

  it('should call sgMail.send with correct parameters when API key is present', async () => {
    process.env.SENDGRID_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'sender@test.com'; // Test custom from address

    // Mock sgMail.send to resolve successfully
    (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

    await sendEmail(testEmailOptions);

    expect(sgMail.send).toHaveBeenCalledTimes(1);
    expect(sgMail.send).toHaveBeenCalledWith({
      to: testEmailOptions.to,
      from: process.env.EMAIL_FROM,
      subject: testEmailOptions.subject,
      html: testEmailOptions.html,
      text: testEmailOptions.text,
    });
  });

  it('should use default EMAIL_FROM if environment variable is not set', async () => {
    process.env.SENDGRID_API_KEY = 'test-key';
    delete process.env.EMAIL_FROM; // Ensure EMAIL_FROM is not set

    (sgMail.send as jest.Mock).mockResolvedValueOnce([{ statusCode: 202 }]);

    await sendEmail(testEmailOptions);

    expect(sgMail.send).toHaveBeenCalledTimes(1);
    expect(sgMail.send).toHaveBeenCalledWith(expect.objectContaining({
      from: expectedFrom, // Check if the default is used
    }));
  });
  
  it('should not call sgMail.send and log a warning if SENDGRID_API_KEY is missing', async () => {
    delete process.env.SENDGRID_API_KEY; // Ensure API key is missing
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn

    await sendEmail(testEmailOptions);

    expect(sgMail.send).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'SENDGRID_API_KEY não configurada. O email não será enviado.'
    );

    consoleWarnSpy.mockRestore(); // Clean up the spy
  });

  it('should propagate errors from sgMail.send', async () => {
    process.env.SENDGRID_API_KEY = 'test-key';
    const testError = new Error('SendGrid Error');
    (sgMail.send as jest.Mock).mockRejectedValueOnce(testError);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error

    await expect(sendEmail(testEmailOptions)).rejects.toThrow(testError);

    expect(sgMail.send).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Erro ao enviar email:', testError);
    
    consoleErrorSpy.mockRestore(); // Clean up the spy
  });
}); 