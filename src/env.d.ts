// `rel` is valid on <form> in HTML, but Astro's JSX types don't list it yet.
declare namespace astroHTML.JSX {
  interface FormHTMLAttributes {
    rel?: string | undefined | null;
  }
}
