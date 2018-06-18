initSidebarItems({"constant":[["BLACK","Black"],["DEFAULT_FONT_SCALE","Default scale, used as `Scale::uniform(DEFAULT_FONT_SCALE)` when no explicit scale is given."],["WHITE","White"]],"enum":[["Align","Describes horizontal alignment preference for positioning & bounds."],["BlendMode","An enum for specifying default and custom blend modes"],["DrawMode","Specifies whether a shape should be drawn filled or as an outline."],["FillRule","The fill rule defines how to determine what is inside and what is outside of the shape."],["FilterMode","Specifies what blending method to use when scaling up/down images."],["Font","A font that defines the shape of characters drawn on the screen. Can be created from a .ttf file or from an image (bitmap fonts)."],["ImageFormat","The supported formats for saving an image."],["LineCap","Line cap as defined by the SVG specification."],["LineJoin","Line join as defined by the SVG specification."]],"fn":[["apply_transformations","Calculates the new total transformation (Model-View-Projection) matrix based on the matrices at the top of the transform and view matrix stacks and sends it to the graphics card."],["circle","Draw a circle."],["clear","Clear the screen to the background color. TODO: Into ?"],["clear_shader","Clears the the current shader for the Context, restoring the default shader."],["draw","Draws the given `Drawable` object to the screen by calling its `draw()` method."],["draw_primitive","Draws the given `Drawable` object to the screen by calling its `draw_ex()` method."],["ellipse","Draw an ellipse."],["get_default_filter","Get the default filter mode for new images."],["get_depth_view","Returns the gfx-rs depth target object for ggez's rendering context."],["get_device","Returns the gfx-rs `Device` object for ggez's rendering context."],["get_drawable_size","Returns the size of the window's underlying drawable in pixels as (width, height). Returns zeros if window doesn't exist."],["get_encoder","Returns the gfx-rs `Encoder` object for ggez's rendering context."],["get_factory","Returns the gfx-rs `Factory` object for ggez's rendering context."],["get_gfx_objects","Returns raw `gfx-rs` state objects, if you want to use `gfx-rs` to write your own graphics pipeline then this gets you the interfaces you need to do so. Returns all the relevant objects at once; getting them one by one is awkward 'cause it tends to create double-borrows on the Context object."],["get_projection","Gets a copy of the context's raw projection matrix"],["get_renderer_info","Returns a string that tells a little about the obtained rendering mode. It is supposed to be human-readable and will change; do not try to parse information out of it!"],["get_screen_coordinates","Returns a rectangle defining the coordinate system of the screen. It will be `Rect { x: left, y: top, w: width, h: height }`"],["get_screen_render_target","Returns the gfx-rs color target object for ggez's rendering context."],["get_size","Returns the size of the window in pixels as (width, height), including borders, titlebar, etc. Returns zeros if window doesn't exist."],["get_transform","Gets a copy of the context's current transform matrix"],["get_window","Returns a reference to the SDL window. Ideally you should not need to use this because ggez would provide all the functions you need without having to dip into SDL itself.  But life isn't always ideal."],["line","Draws a line of one or more connected segments."],["origin","Sets the current model transform to the origin transform (no transformation)"],["points","Draws points (as rectangles)"],["polygon","Draws a closed polygon"],["pop_transform","Pops the transform matrix off the top of the transform (model) matrix stack of the `Context`."],["present","Tells the graphics system to actually put everything on the screen. Call this at the end of your `EventHandler`'s `draw()` method."],["push_transform","Pushes a homogeneous transform matrix to the top of the transform (model) matrix stack of the `Context`. If no matrix is given, then pushes a copy of the current transform matrix to the top of the stack."],["rectangle","Draws a rectangle."],["screenshot","Take a screenshot by outputting the current render surface (screen or selected canvas) to a PNG file."],["set_blend_mode","Sets the blend mode of the currently active shader program"],["set_canvas","Set the canvas to render to. Specifying `Option::None` will cause all rendering to be done directly to the screen."],["set_default_filter","Sets the default filter mode used to scale images."],["set_fullscreen","Sets the window to fullscreen or back."],["set_mode","Sets the window mode, such as the size and other properties."],["set_projection","Sets the raw projection matrix to the given homogeneous transformation matrix."],["set_resolution","Sets the window resolution based on the specified width and height."],["set_screen_coordinates","Sets the bounds of the screen viewport."],["set_shader","Set the current  shader for the Context to render with"],["set_transform","Sets the current model transformation to the given homogeneous transformation matrix."],["set_window_icon","Sets the window icon."],["set_window_title","Sets the window title."],["transform","Premultiplies the given transform with the current model transform."],["transform_projection","Premultiplies the given transformation matrix with the current projection matrix"],["use_shader","Use a shader until the returned lock goes out of scope"]],"mod":[["pipe",""],["spritebatch","A `SpriteBatch` is a way to efficiently draw a large number of copies of the same image, or part of the same image.  It's useful for implementing tiled maps, spritesheets, particles, and other such things."]],"struct":[["BitmapFont","A bitmap font where letter widths are infered"],["CanvasGeneric","A generic canvas independent of graphics backend. This type should probably never be used directly; use `ggez::graphics::Canvas` instead."],["Color","A RGBA color in the `sRGB` color space represented as `f32`'s in the range `[0.0-1.0]`"],["DrawParam","A struct containing all the necessary info for drawing a Drawable."],["EmptyConst","A type for empty shader data for shaders that do not require any additional data to be sent to the GPU"],["FillOptions","Parameters for the fill tessellator."],["FontId","Id for a font, the default `FontId(0)` will always be present in a `GlyphBrush`"],["GlBackendSpec","A backend specification for OpenGL. This is different from `conf::Backend` because this needs to be its own struct to implement traits upon, and because there may need to be a layer of translation between what the user specifies in the config, and what the graphics backend init code actually gets."],["Globals","Internal structure containing global shader state."],["ImageGeneric","Generic in-GPU-memory image data available to be drawn on the screen."],["InstanceProperties","Internal structure containing values that are different for each drawable object."],["Mesh","2D polygon mesh."],["MeshBuilder","A builder for creating `Mesh`es."],["PrimitiveDrawParam","A `DrawParam` that has been crunched down to a single matrix. Useful for doing matrix-based coordiante transformations, I hope."],["Rect","A simple 2D rectangle."],["ShaderGeneric","A `ShaderGeneric` reprensents a handle user-defined shader that can be used with a ggez graphics context that is generic over `gfx::Resources`"],["ShaderLock","A lock for RAII shader regions. The shader automatically gets cleared once the lock goes out of scope, restoring the previous shader (if any)."],["StrokeOptions","Parameters for the tessellator."],["Text","Drawable text created from a `Font`."],["TextCached","Drawable text. Can be either monolithic, or consist of differently-formatted fragments."],["TextFragment","A piece of text with optional color, font and font scale information. These options take precedence over any similar field/argument. Can be implicitly constructed from `String`, `(String, Color)`, and `(String, FontId, Scale)`."],["Vertex","Internal structure containing vertex data."]],"trait":[["BackendSpec","A marker trait saying that something is a label for a particular backend, with associated gfx-rs types for that backend."],["Drawable","All types that can be drawn on the screen implement the `Drawable` trait."],["ShaderHandle","A trait that is used to create trait objects to abstract away the Structure type of the constant data for drawing"]],"type":[["Canvas","A canvas that can be rendered to instead of the screen (sometimes referred to as \"render target\" or \"render to texture\"). Set the canvas with the `ggez::graphics::set_canvas()` function, and then anything you draw will be drawn to the canvas instead of the screen."],["Image","In-GPU-memory image data available to be drawn on the screen, using the OpenGL backend."],["Scale","Aliased type to allow lib usage without declaring underlying rusttype lib"],["Shader","A `Shader` represents a handle to a user-defined shader that can be used with a ggez graphics context"],["ShaderId","An ID used by the `GraphicsContext` to uniquely identify a shader"],["WrapMode","Specifies how to wrap textures."]]});