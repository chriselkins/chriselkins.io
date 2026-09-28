// Gemini has no URL parameter for a prompt, so this fills its box from ?prompt=, which is how my
// tools page links to it. It only fills the box; sending is still up to me.
{
  const prompt = new URLSearchParams(location.search).get('prompt');
  let tries = 0;

  const fill = () => {
    const box = document.querySelector('div[contenteditable="true"][role="textbox"]');
    if (box) {
      box.focus();
      // execCommand is deprecated, but it's still the only way to type into a rich editor as if by
      // hand, which keeps Gemini's state in step and turns newlines into lines.
      document.execCommand('insertText', false, prompt);
    } else if (++tries < 40) {
      setTimeout(fill, 250);
    }
  };

  if (prompt) fill();
}
